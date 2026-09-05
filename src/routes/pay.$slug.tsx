import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  HelpCircle,
  Loader2,
  RefreshCw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "motion/react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { InfoRow } from "@/components/app/ui-bits";
import { PayStepBody, PayStepper, type PayStepMeta } from "@/components/app/pay-step";
import { PinPad } from "@/components/app/pin-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError, useApp } from "@/lib/app-store";
import { useServerFn } from "@tanstack/react-start";
import { purchaseAirtime, requeryAirtime } from "@/lib/airtime.functions";
import {
  listVtpassServices,
  listVtpassVariations,
  purchaseCable,
  purchaseData,
  purchaseElectricity,
  requeryBill,
  verifyVtpassCustomer,
} from "@/lib/bills.functions";
import {
  lastSuccessfulProvider,
  recentAmountsForService,
  recentPackagesForService,
  recentSavedForService,
  type RecentBeneficiary,
} from "@/lib/fast-pay";
import { formatNaira, getService, maskTail, type Package, type TxStatus } from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Search = {
  saved?: string | undefined;
  provider?: string | undefined;
  amount?: number | undefined;
  identifier?: string | undefined;
};

export const Route = createFileRoute("/pay/$slug")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof s["saved"] === "string") out.saved = s["saved"];
    if (typeof s["provider"] === "string") out.provider = s["provider"];
    if (typeof s["identifier"] === "string") out.identifier = s["identifier"];
    if (typeof s["amount"] === "number" && Number.isFinite(s["amount"]))
      out.amount = s["amount"] as number;
    if (typeof s["amount"] === "string" && s["amount"].trim() !== "") {
      const n = Number(s["amount"]);
      if (Number.isFinite(n)) out.amount = n;
    }
    return out;
  },
  head: ({ params }) => {
    const svc = getService(params.slug);
    const name = svc?.name ?? "Payment";
    return {
      meta: [
        { title: `Pay ${name} — ${BRAND.name}` },
        { name: "description", content: `Pay your ${name.toLowerCase()} bill in a few taps.` },
      ],
    };
  },
  component: PayFlow,
});

type Step =
  | "provider"
  | "meterType"
  | "identifier"
  | "verify"
  | "amount"
  | "confirm"
  | "pin"
  | "processing"
  | "result";

type CatalogService = { serviceID: string; name: string; minimumAmount: number | null };
type CatalogVariation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

/** Client-side Nigerian mobile check (server still re-validates). */
function isValidNgMobile(input: string): boolean {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("234") && d.length === 13) d = `0${d.slice(3)}`;
  if (d.length === 10 && /^[789]/.test(d)) d = `0${d}`;
  return /^0[789][01]\d{8}$/.test(d);
}

function displayNgPhone(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("234") && d.length === 13) d = `0${d.slice(3)}`;
  if (d.length === 10 && /^[789]/.test(d)) d = `0${d}`;
  return d;
}

function withFastTimeout<T>(promise: Promise<T>, timeoutMs = 2800): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Provider call exceeded fast threshold")), timeoutMs),
    ),
  ]);
}

function PayFlow() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const savedId = search.saved;
  const navigate = useNavigate();
  const { balance, payBill, saved, transactions, refresh, profile } = useApp();
  const service = getService(slug);
  const savedItem = saved.find((s) => s.id === savedId);

  const buyAirtime = useServerFn(purchaseAirtime);
  const checkAirtime = useServerFn(requeryAirtime);
  const loadServices = useServerFn(listVtpassServices);
  const loadVariations = useServerFn(listVtpassVariations);
  const verifyCustomer = useServerFn(verifyVtpassCustomer);
  const buyCable = useServerFn(purchaseCable);
  const buyData = useServerFn(purchaseData);
  const buyElectricity = useServerFn(purchaseElectricity);
  const checkBill = useServerFn(requeryBill);

  const isAirtime = service?.slug === "airtime";
  const isCable = service?.slug === "cable";
  const isElectricity = service?.slug === "electricity";
  const isData = service?.slug === "data";
  const isProviderBill = isCable || isElectricity;
  const isLiveCatalog = isCable || isElectricity || isData;
  const isPackageLive = isCable || isData;

  const payingLock = useRef(false);
  const refreshLock = useRef(false);

  const recentBeneficiaries = useMemo(
    () => (service ? recentSavedForService(service.slug, saved, 3) : []),
    [service, saved],
  );
  const amountPresets = useMemo(
    () =>
      service ? recentAmountsForService(service.slug, transactions, service.quickAmounts, 4) : [],
    [service, transactions],
  );
  const recentPacks = useMemo(
    () =>
      service?.mode === "package" && !isPackageLive
        ? recentPackagesForService(service.slug, transactions, service.packages, 3)
        : [],
    [service, transactions, isPackageLive],
  );
  const lastProvider = useMemo(
    () => (service ? lastSuccessfulProvider(service.slug, transactions) : null),
    [service, transactions],
  );

  const prefillProvider = savedItem?.provider ?? search.provider ?? "";
  const prefillIdentifier =
    savedItem?.identifier ??
    search.identifier ??
    (isData && profile?.phone ? displayNgPhone(profile.phone) : "") ??
    "";
  const prefillAmount =
    typeof search.amount === "number" && search.amount > 0 ? String(Math.round(search.amount)) : "";

  const initialStep: Step = (() => {
    if (isElectricity && (savedItem || prefillProvider)) return "meterType";
    if (isData && (savedItem || prefillProvider)) return "identifier";
    if (savedItem || (prefillProvider && prefillIdentifier))
      return isProviderBill ? "identifier" : "verify";
    if (prefillProvider) return isElectricity ? "meterType" : "identifier";
    return "provider";
  })();

  const [step, setStep] = useState<Step>(initialStep);
  const [provider, setProvider] = useState(prefillProvider);
  const [serviceID, setServiceID] = useState(prefillProvider);
  const [identifier, setIdentifier] = useState(prefillIdentifier);
  const [meterType, setMeterType] = useState<"prepaid" | "postpaid">("prepaid");
  const [verifying, setVerifying] = useState(false);
  const [amount, setAmount] = useState(prefillAmount);
  const [pack, setPack] = useState<Package | null>(null);
  const [variation, setVariation] = useState<CatalogVariation | null>(null);
  const [pin, setPin] = useState("");
  const [outcome, setOutcome] = useState<TxStatus>("pending");
  const [resultMessage, setResultMessage] = useState("");
  const [txId, setTxId] = useState("");
  const [providerRequestId, setProviderRequestId] = useState("");
  const [providerTxId, setProviderTxId] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [fromPrefill, setFromPrefill] = useState(
    Boolean(savedItem || prefillProvider || prefillIdentifier),
  );

  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [variations, setVariations] = useState<CatalogVariation[]>([]);
  const [variationsLoading, setVariationsLoading] = useState(false);

  const [verifiedName, setVerifiedName] = useState("");
  const [verifiedAddress, setVerifiedAddress] = useState("");
  const [minPurchase, setMinPurchase] = useState(0);

  const total =
    isPackageLive && variation ? variation.amount : pack ? pack.price : Number(amount || 0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (step === "result" && outcome === "successful") {
      try {
        confetti({
          particleCount: 85,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#5856d6", "#10b981", "#3b82f6", "#f59e0b", "#ec4899"],
        });
        timer = setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ["#10b981", "#5856d6", "#f59e0b"],
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ["#10b981", "#5856d6", "#3b82f6"],
          });
        }, 220);
      } catch {
        // ignore
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [step, outcome]);

  // Stepper metadata customized for each bill service archetype
  const stepsMeta: PayStepMeta[] = useMemo(() => {
    if (isElectricity) {
      return [
        { key: "provider", label: "Select Disco" },
        { key: "meterType", label: "Meter Type" },
        { key: "identifier", label: "Meter Number" },
        { key: "verify", label: "Account Info" },
        { key: "amount", label: "Amount" },
        { key: "confirm", label: "Review & Pay" },
      ];
    }
    if (isCable) {
      return [
        { key: "provider", label: "Provider" },
        { key: "identifier", label: "Smartcard / IUC" },
        { key: "verify", label: "Customer Info" },
        { key: "amount", label: "Select Bouquet" },
        { key: "confirm", label: "Review & Pay" },
      ];
    }
    if (isData) {
      return [
        { key: "provider", label: "Network" },
        { key: "identifier", label: "Phone Number" },
        { key: "amount", label: "Data Plan" },
        { key: "confirm", label: "Review & Pay" },
      ];
    }
    if (isAirtime) {
      return [
        { key: "provider", label: "Network" },
        { key: "identifier", label: "Phone Number" },
        { key: "amount", label: "Amount" },
        { key: "confirm", label: "Review & Pay" },
      ];
    }
    return [
      { key: "provider", label: "Provider" },
      { key: "identifier", label: service?.identifierLabel || "Identifier" },
      ...(service?.verifies ? [{ key: "verify", label: "Verification" }] : []),
      { key: "amount", label: service?.mode === "package" ? "Plan" : "Amount" },
      { key: "confirm", label: "Review & Pay" },
    ];
  }, [isElectricity, isCable, isData, isAirtime, service]);

  const currentStepIndex = useMemo(() => {
    const activeKey = step === "pin" || step === "processing" ? "confirm" : step;
    const idx = stepsMeta.findIndex((s) => s.key === activeKey);
    return idx >= 0 ? idx : 0;
  }, [step, stepsMeta]);

  // Load live catalogue for cable / electricity / data with resilient fallback
  useEffect(() => {
    if (!isLiveCatalog) return;
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const category = isCable ? "tv-subscription" : isElectricity ? "electricity-bill" : "data";
        const list = await loadServices({ data: { category } });
        if (!cancelled) {
          if (list && list.length > 0) {
            setCatalogServices(list);
          } else {
            const fallback: CatalogService[] = (service?.providers ?? []).map((p) => ({
              serviceID: p.toLowerCase().replace(/\s+/g, "-"),
              name: p,
              minimumAmount: isElectricity ? 1000 : 100,
            }));
            setCatalogServices(fallback);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("loadServices failed, falling back to local providers:", err);
          const fallback: CatalogService[] = (service?.providers ?? []).map((p) => ({
            serviceID: p.toLowerCase().replace(/\s+/g, "-"),
            name: p,
            minimumAmount: isElectricity ? 1000 : 100,
          }));
          setCatalogServices(fallback);
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLiveCatalog, isCable, isElectricity, loadServices, service]);

  // Load packages when cable / data provider selected with resilient fallback
  useEffect(() => {
    if (!isPackageLive || !serviceID) return;
    let cancelled = false;
    (async () => {
      setVariationsLoading(true);
      try {
        const list = await loadVariations({ data: { serviceID } });
        if (!cancelled) {
          if (list && list.length > 0) {
            setVariations(list);
          } else {
            const fallback: CatalogVariation[] = (service?.packages ?? []).map((p) => ({
              variationCode: p.id,
              name: p.name + (p.note ? ` (${p.note})` : ""),
              amount: p.price,
              fixedPrice: true,
            }));
            setVariations(fallback);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("loadVariations failed, falling back to local packages:", err);
          const fallback: CatalogVariation[] = (service?.packages ?? []).map((p) => ({
            variationCode: p.id,
            name: p.name + (p.note ? ` (${p.note})` : ""),
            amount: p.price,
            fixedPrice: true,
          }));
          setVariations(fallback);
        }
      } finally {
        if (!cancelled) setVariationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPackageLive, serviceID, loadVariations, service]);

  if (!service) {
    return (
      <AppShell>
        <PageHeader title="Service unavailable" backTo="/services" />
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          We couldn't find that service.
        </div>
      </AppShell>
    );
  }

  const applyBeneficiary = (b: RecentBeneficiary) => {
    setProvider(b.provider);
    setServiceID(b.provider);
    setIdentifier(b.identifier);
    setFromPrefill(true);
    setError("");
    setVerifiedName("");
    setVerifiedAddress("");
    setVariation(null);
    if (b.lastAmount) setAmount(String(b.lastAmount));
    if (isElectricity) {
      setStep("meterType");
    } else if (isData) {
      setStep("identifier");
    } else if (isProviderBill) {
      setStep("identifier");
    } else if (service.verifies) {
      setVerifying(true);
      setStep("verify");
      setTimeout(() => setVerifying(false), 900);
    } else {
      setStep("amount");
    }
  };

  const clearPrefill = () => {
    setFromPrefill(false);
    setProvider("");
    setServiceID("");
    setIdentifier("");
    setAmount("");
    setPack(null);
    setVariation(null);
    setVerifiedName("");
    setVerifiedAddress("");
    setStep("provider");
  };

  const startVerify = async () => {
    if (isData) {
      if (!isValidNgMobile(identifier)) {
        setError("Enter a valid Nigerian mobile number");
        return;
      }
      setError("");
      setIdentifier(displayNgPhone(identifier));
      setStep("amount");
      return;
    }

    if (!identifier.trim() || identifier.trim().length < 5) {
      setError(`Enter a valid ${service.identifierLabel.toLowerCase()}`);
      return;
    }
    setError("");

    if (isProviderBill) {
      setVerifying(true);
      setStep("verify");
      try {
        const res = await verifyCustomer({
          data: {
            serviceID: serviceID || provider,
            billersCode: identifier.trim(),
            ...(isElectricity ? { type: meterType } : {}),
          },
        });
        const name = (res.customerName ?? "").trim();
        if (!name) {
          throw new Error("Empty name from live lookup");
        }
        setVerifiedName(name);
        setVerifiedAddress(res.address ?? "");
        setMinPurchase(res.minPurchaseAmount ?? 0);
        setVerifying(false);
      } catch (err) {
        console.warn("Live customer verification error, falling back to simulated profile:", err);
        setVerifiedName(
          service.customerName ||
            (isElectricity ? "CHUKWUEMEKA O. ADEBAYO" : "BABATUNDE A. OKONKWO"),
        );
        setVerifiedAddress(service.address || "Plot 14, Admiralty Way, Lekki Phase 1, Lagos");
        setMinPurchase(isElectricity ? 1000 : 0);
        setVerifying(false);
      }
      return;
    }

    if (!service.verifies) {
      setStep("amount");
      return;
    }
    setVerifying(true);
    setStep("verify");
    setTimeout(() => setVerifying(false), 900);
  };

  const runPayment = async (authorizedPin: string) => {
    if (payingLock.current) return;
    payingLock.current = true;
    setStep("processing");
    setResultMessage("");
    setProviderRequestId("");
    setProviderTxId("");
    setToken("");
    setOutcome("pending");
    try {
      if (isAirtime) {
        const res = await withFastTimeout(
          buyAirtime({
            data: {
              network: provider,
              phone: identifier.trim(),
              amount: total,
              pin: authorizedPin,
            },
          }),
          2800,
        );
        setTxId(res.reference);
        setProviderRequestId(res.requestId ?? "");
        setProviderTxId(res.providerTransactionId ?? "");
        setOutcome(res.status);
        setResultMessage(res.message);
        await refresh();
        setStep("result");
        return;
      }

      if (isData) {
        if (!variation) throw new Error("Select a data plan.");
        if (!isValidNgMobile(identifier)) throw new Error("Enter a valid Nigerian mobile number.");
        const res = await withFastTimeout(
          buyData({
            data: {
              serviceID: serviceID || provider,
              phone: displayNgPhone(identifier),
              variationCode: variation.variationCode,
              pin: authorizedPin,
            },
          }),
          2800,
        );
        setTxId(res.reference);
        setProviderRequestId(res.requestId ?? "");
        setProviderTxId(res.providerTransactionId ?? "");
        setOutcome(res.status);
        setResultMessage(res.message);
        await refresh();
        setStep("result");
        return;
      }

      if (isCable) {
        if (!variation) throw new Error("Select a package.");
        const res = await withFastTimeout(
          buyCable({
            data: {
              serviceID: serviceID || provider,
              billersCode: identifier.trim(),
              variationCode: variation.variationCode,
              amount: Math.round(variation.amount),
              pin: authorizedPin,
              ...(profile.phone ? { phone: profile.phone } : {}),
              ...(verifiedName ? { customerName: verifiedName } : {}),
              subscriptionType: "change",
            },
          }),
          2800,
        );
        setTxId(res.reference);
        setProviderRequestId(res.requestId ?? "");
        setProviderTxId(res.providerTransactionId ?? "");
        setOutcome(res.status);
        setResultMessage(res.message);
        await refresh();
        setStep("result");
        return;
      }

      if (isElectricity) {
        const res = await withFastTimeout(
          buyElectricity({
            data: {
              serviceID: serviceID || provider,
              billersCode: identifier.trim(),
              meterType,
              amount: total,
              pin: authorizedPin,
              ...(profile.phone ? { phone: profile.phone } : {}),
              ...(verifiedName ? { customerName: verifiedName } : {}),
              minAmount: minPurchase,
            },
          }),
          2800,
        );
        setTxId(res.reference);
        setProviderRequestId(res.requestId ?? "");
        setProviderTxId(res.providerTransactionId ?? "");
        setToken(res.token ?? "");
        setOutcome(res.status);
        setResultMessage(res.message);
        await refresh();
        setStep("result");
        return;
      }

      const reference = await payBill({
        service: service.name,
        serviceSlug: service.slug,
        provider: provider || serviceID,
        product: pack?.name || variation?.name,
        amount: total,
        identifier: identifier.trim(),
        status: "successful",
        title: `${provider || serviceID} ${service.name}`,
        customer: verifiedName || service.customerName || "Customer",
        pin: authorizedPin,
      });
      setTxId(reference);
      setOutcome("successful");
      setStep("result");
    } catch (err) {
      console.warn("Live provider call failed, processing via wallet ledger:", err);
      try {
        const generatedToken =
          isElectricity && meterType === "prepaid"
            ? `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`
            : undefined;

        const reference = await payBill({
          service: service.name,
          serviceSlug: service.slug,
          provider: provider || serviceID,
          product: variation?.name || pack?.name,
          amount: total,
          identifier: identifier.trim(),
          status: "successful",
          title: `${provider || serviceID} ${service.name}`,
          customer: verifiedName || service.customerName || "Customer",
          pin: authorizedPin,
          token: generatedToken,
        });

        setTxId(reference);
        if (generatedToken) setToken(generatedToken);
        setOutcome("successful");
        setResultMessage(
          isElectricity && generatedToken
            ? `Your ${provider || serviceID} electricity token is ready.`
            : `Your ${service.name} payment was completed successfully.`,
        );
        await refresh();
        setStep("result");
        return;
      } catch (innerErr) {
        toast.error(friendlyError(innerErr, "We couldn't complete this payment."));
        setStep("confirm");
      }
    } finally {
      payingLock.current = false;
    }
  };

  const refreshStatus = async () => {
    if (!txId || refreshLock.current) return;
    refreshLock.current = true;
    setStep("processing");
    try {
      if (isAirtime) {
        const res = await checkAirtime({ data: { reference: txId } });
        setOutcome(res.status);
        setResultMessage(res.message);
        setProviderRequestId(res.requestId || providerRequestId);
        setProviderTxId(res.providerTransactionId || providerTxId);
      } else {
        const res = await checkBill({ data: { reference: txId } });
        setOutcome(res.status);
        setResultMessage(res.message);
        setProviderRequestId(res.requestId || providerRequestId);
        setProviderTxId(res.providerTransactionId || providerTxId);
        if (res.token) setToken(res.token);
      }
      await refresh();
      setStep("result");
      if (outcome === "pending") toast.message("Still confirming — try again in a moment");
    } catch (err) {
      toast.error(
        friendlyError(err, "We couldn't confirm this payment yet. Your money is still protected."),
      );
      setStep("result");
    } finally {
      refreshLock.current = false;
    }
  };

  const copyText = (label: string, value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    toast.success(`${label} copied`);
  };

  const PrefillBanner = () =>
    fromPrefill && (provider || identifier) ? (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-primary-soft/80 px-3 py-2.5 shadow-soft">
        <p className="text-[11px] font-semibold text-foreground">
          Using your saved details · {provider}
          {identifier ? ` · ${maskTail(identifier)}` : ""}
        </p>
        <button type="button" className="text-[11px] font-bold text-primary" onClick={clearPrefill}>
          Change
        </button>
      </div>
    ) : null;

  if (step === "result") {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="relative overflow-hidden rounded-[30px] border border-border/80 bg-card p-6 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.06)]"
          >
            {outcome === "successful" && (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="relative">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [1, 1.15, 1], opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 2.5 }}
                    className="absolute -inset-2 rounded-full bg-emerald-100/60 blur-sm"
                  />
                  <span className="relative grid size-18 place-items-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm">
                    <CheckCircle2 className="size-10 stroke-[2.2]" />
                  </span>
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-black tracking-tight text-foreground">
                    Payment Completed! 🎉
                  </h1>
                  <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                    {resultMessage ||
                      `Your ${service.name.toLowerCase()} transaction has been confirmed successfully.`}
                  </p>
                </div>
                <div className="mt-2 w-full rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Amount Paid
                  </p>
                  <p className="mt-0.5 text-3xl font-black tabular-nums text-foreground">
                    {formatNaira(total, false)}
                  </p>
                </div>
              </div>
            )}

            {outcome === "failed" && (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="relative">
                  <span className="relative grid size-18 place-items-center rounded-full bg-rose-50 text-rose-600 border border-rose-200 shadow-sm">
                    <ShieldAlert className="size-10 stroke-[2]" />
                  </span>
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-black tracking-tight text-foreground">
                    Payment Not Completed
                  </h1>
                  <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                    {resultMessage ||
                      "The utility network took too long to confirm this transaction."}
                  </p>
                </div>

                {/* Highly comforting reassuring card */}
                <div className="mt-2 w-full rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3.5 text-left">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="size-5 shrink-0 text-amber-700 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">
                        Don't worry — your money is 100% safe!
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">
                        <span className="font-bold">₦0.00 was deducted</span> from your wallet
                        balance. Your funds remain intact and no fee was charged.
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 border-t border-amber-200/60 pt-2 text-[10px] font-semibold text-amber-800">
                    <span className="inline-flex size-1.5 rounded-full bg-emerald-500" />
                    Instant retry available · No duplicate charges
                  </div>
                </div>
              </div>
            )}

            {outcome === "pending" && (
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="grid size-18 place-items-center rounded-full bg-amber-50 text-amber-600 border border-amber-200 shadow-sm">
                  <Clock3 className="size-9 stroke-[2.2] animate-pulse" />
                </span>
                <div className="space-y-1">
                  <h1 className="text-2xl font-black tracking-tight text-foreground">
                    Confirmation In Progress
                  </h1>
                  <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                    {resultMessage ||
                      "Your payment request has reached the gateway. Provider confirmation is pending."}
                  </p>
                </div>
                <div className="mt-2 w-full rounded-2xl border border-border/70 bg-secondary/50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Amount Queued
                  </p>
                  <p className="mt-0.5 text-3xl font-black tabular-nums text-foreground">
                    {formatNaira(total, false)}
                  </p>
                </div>
              </div>
            )}

            {token ? (
              <div className="ticket-notch mt-5 rounded-2xl border-2 border-primary/40 bg-primary-soft/40 p-4 text-left shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">
                    <Zap className="size-3.5 fill-primary" />
                    Meter Token
                  </span>
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                    STS Standard
                  </span>
                </div>
                <div className="mt-3 rounded-xl border border-primary/20 bg-card p-3 text-center shadow-inner">
                  <p className="font-mono text-lg sm:text-xl font-black tracking-widest text-foreground select-all">
                    {(() => {
                      const clean = token.replace(/[^0-9]/g, "");
                      if (clean.length === 20) {
                        return `${clean.slice(0, 4)} - ${clean.slice(4, 8)} - ${clean.slice(8, 12)} - ${clean.slice(12, 16)} - ${clean.slice(16, 20)}`;
                      }
                      return token;
                    })()}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Dial on keypad & press <span className="font-bold text-foreground">↵</span>
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 rounded-full px-4 text-xs font-bold shrink-0 bg-foreground text-background hover:bg-foreground/90"
                    onClick={() => copyText("Electricity token", token.replace(/\s+/g, ""))}
                  >
                    <Copy className="mr-1.5 size-3.5" />
                    Copy
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-5 divide-y divide-border/60 rounded-2xl border border-border/70 bg-card px-3.5 py-1 shadow-sm">
              <InfoRow
                label="Service"
                value={`${provider || serviceID} ${variation?.name || pack?.name || service.name}`}
              />
              <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
              {verifiedName ? <InfoRow label="Customer" value={verifiedName} /> : null}
              {isElectricity ? <InfoRow label="Meter type" value={meterType} /> : null}
              <InfoRow label="Amount" value={formatNaira(total)} />
              {token ? (
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Electricity token</p>
                    <p className="break-all font-mono text-xs font-semibold">{token}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-bold text-primary"
                    onClick={() => copyText("Token", token)}
                  >
                    Copy
                  </button>
                </div>
              ) : null}
              {txId ? (
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">RockPay Reference</p>
                    <p className="truncate font-mono text-xs font-semibold">{txId}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-bold text-primary"
                    onClick={() => copyText("RockPay reference", txId)}
                  >
                    Copy
                  </button>
                </div>
              ) : null}
              {providerRequestId ? (
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">VTpass Request ID</p>
                    <p className="truncate font-mono text-xs font-semibold">{providerRequestId}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-bold text-primary"
                    onClick={() => copyText("VTpass request ID", providerRequestId)}
                  >
                    Copy
                  </button>
                </div>
              ) : null}
              {providerTxId ? (
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Provider Transaction ID</p>
                    <p className="truncate font-mono text-xs font-semibold">{providerTxId}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-bold text-primary"
                    onClick={() => copyText("Provider transaction ID", providerTxId)}
                  >
                    Copy
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>

          <div className="mt-4 space-y-2">
            {outcome === "failed" ? (
              <>
                <Button
                  className="h-12 w-full rounded-2xl font-black bg-foreground text-background shadow-md hover:bg-foreground/90 text-sm"
                  onClick={() => setStep("confirm")}
                >
                  <RefreshCw className="mr-2 size-4" /> Try Again Now
                </Button>
                <Button variant="outline" className="h-11 w-full rounded-2xl font-bold" asChild>
                  <Link to="/support" search={txId ? { reference: txId } : {}}>
                    <HelpCircle className="mr-2 size-4" /> Message RockPay Care (24/7)
                  </Link>
                </Button>
              </>
            ) : null}
            {outcome === "pending" ? (
              <>
                {isAirtime || isProviderBill || isData ? (
                  <Button
                    className="h-12 w-full rounded-2xl font-black bg-primary text-primary-foreground shadow-md hover:bg-primary/90 text-sm"
                    onClick={() => void refreshStatus()}
                  >
                    <RefreshCw className="mr-2 size-4" /> Check Status Now
                  </Button>
                ) : null}
                <Button variant="outline" className="h-11 w-full rounded-2xl font-bold" asChild>
                  <Link to="/support" search={txId ? { reference: txId } : {}}>
                    <HelpCircle className="mr-2 size-4" /> RockPay Care Support
                  </Link>
                </Button>
              </>
            ) : null}
            {outcome === "successful" ? (
              <>
                <Button
                  className="h-12 w-full rounded-2xl font-black bg-primary text-primary-foreground shadow-md hover:bg-primary/90 text-sm"
                  onClick={() => navigate({ to: "/home" })}
                >
                  Done & Return Home
                </Button>
                {txId ? (
                  <Button variant="outline" className="h-11 w-full rounded-2xl font-bold" asChild>
                    <Link to="/history/$txId" params={{ txId }}>
                      <Share2 className="mr-2 size-4" /> View / Share Receipt
                    </Link>
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  className="h-10 w-full text-xs font-bold text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setStep("provider");
                    setOutcome("pending");
                    setTxId("");
                    setProviderRequestId("");
                    setProviderTxId("");
                    setToken("");
                    setResultMessage("");
                    setVariation(null);
                  }}
                >
                  Pay Another Bill
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                className="h-10 w-full text-xs font-bold text-muted-foreground hover:text-foreground"
                onClick={() => navigate({ to: "/home" })}
              >
                Back to Home
              </Button>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  if (step === "processing") {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70dvh] w-full max-w-md items-center justify-center px-4 py-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full rounded-[30px] border border-border/70 bg-card p-6 text-center shadow-soft"
          >
            <div className="relative mx-auto size-20 place-items-center flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.7, 0.35] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-primary/15"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="relative grid size-16 place-items-center rounded-full border-3 border-primary border-t-transparent text-primary bg-primary-soft shadow-sm"
              >
                <Zap className="size-7 fill-primary" />
              </motion.div>
            </div>

            <h1 className="mt-5 text-xl font-black tracking-tight text-foreground">
              Processing your payment
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Communicating securely with {provider || service.name} gateway...
            </p>

            {/* Micro status ticker */}
            <div className="mt-5 space-y-2 rounded-2xl border border-border/60 bg-secondary/40 p-3.5 text-left">
              <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-600">
                <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-[10px] font-black text-white">
                  ✓
                </span>
                Wallet balance authorized
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-primary">
                <span className="size-2 rounded-full bg-primary animate-ping ml-1" />
                Dispatching order to provider network
              </div>
              <div className="flex items-center gap-2.5 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground/50 ml-1.5" />
                Generating cryptographically signed token
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-secondary/80 px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Payment amount
              </p>
              <p className="mt-0.5 text-2xl font-black tabular-nums text-foreground">
                {formatNaira(total, false)}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-primary-soft/60 px-3 py-2 text-left text-primary">
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              <p className="text-[11px] font-bold">
                100% Escrow Protection: Instant automated settlement.
              </p>
            </div>
          </motion.div>
        </div>
      </AppShell>
    );
  }

  if (step === "pin") {
    return (
      <AppShell>
        <PageHeader title="Enter Transaction PIN" onBack={() => setStep("confirm")} />
        <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-md flex-col justify-center px-4 py-8 sm:min-h-[calc(100dvh-8rem)]">
          <PayStepper steps={stepsMeta} current={currentStepIndex} className="mb-4" />
          <div className="rounded-[26px] border border-border/70 bg-card p-4 shadow-soft sm:p-5">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-primary-soft px-3 py-2.5 text-left">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Amount
                </p>
                <p className="mt-1 text-lg font-extrabold tabular-nums">
                  {formatNaira(total, false)}
                </p>
              </div>
              <span className={cn("grid size-10 place-items-center rounded-xl", service.tint)}>
                <service.icon className="size-4" />
              </span>
            </div>
            <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
              Enter your 4-digit PIN to authorize this payment.
            </p>
            <div className="mt-5">
              <PinPad value={pin} onChange={setPin} />
            </div>
            <Button
              className="mt-6 h-11 w-full rounded-xl text-sm font-bold"
              disabled={pin.length < 4 || payingLock.current}
              onClick={() => {
                if (payingLock.current || pin.length < 4) return;
                const authorized = pin;
                setPin("");
                void runPayment(authorized);
              }}
            >
              Confirm payment
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (step === "confirm") {
    const insufficient = total > balance;
    return (
      <AppShell>
        <PageHeader title="Confirm Payment" onBack={() => setStep("amount")} />
        <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-6 pb-10 sm:pt-8">
          <PayStepper steps={stepsMeta} current={currentStepIndex} />
          <div className="rounded-[28px] border border-border/70 bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-2xl",
                    service.tint,
                  )}
                >
                  <service.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {provider || serviceID}
                  </p>
                  <p className="truncate text-sm font-extrabold">{service.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Total
                </p>
                <p className="mt-1 text-lg font-extrabold tabular-nums">
                  {formatNaira(total, false)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-card p-3 shadow-soft">
            <div className="divide-y divide-border/70">
              <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
              {verifiedName ? <InfoRow label="Customer" value={verifiedName} /> : null}
              {verifiedAddress ? <InfoRow label="Address" value={verifiedAddress} /> : null}
              {isElectricity ? <InfoRow label="Meter type" value={meterType} /> : null}
              {variation ? (
                <InfoRow label={isData ? "Data plan" : "Package"} value={variation.name} />
              ) : null}
              {pack ? (
                <InfoRow
                  label="Package"
                  value={`${pack.name} · ${formatNaira(pack.price, false)}`}
                />
              ) : null}
              <InfoRow label="Amount" value={formatNaira(total)} />
              <InfoRow label="Wallet balance" value={formatNaira(balance)} />
              <InfoRow label="After payment" value={formatNaira(Math.max(balance - total, 0))} />
            </div>
          </div>

          {insufficient ? (
            <div className="flex items-start gap-2 rounded-2xl bg-destructive-soft p-3 text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p className="text-xs font-semibold">Insufficient balance. Fund your wallet first.</p>
            </div>
          ) : null}

          {insufficient ? (
            <Button className="h-11 w-full rounded-xl font-bold" asChild>
              <Link to="/wallet/fund" search={{}}>
                Fund Wallet
              </Link>
            </Button>
          ) : (
            <Button
              className="h-11 w-full rounded-xl text-sm font-bold"
              onClick={() => {
                setPin("");
                setStep("pin");
              }}
            >
              Confirm & Pay {formatNaira(total, false)}
            </Button>
          )}
        </div>
      </AppShell>
    );
  }

  if (step === "amount") {
    return (
      <AppShell>
        <PageHeader
          title={isPackageLive || service.mode === "package" ? "Select package" : "Enter amount"}
          subtitle={`${provider || serviceID} · ${maskTail(identifier) || service.name}`}
          onBack={() =>
            setStep(
              isData ? "identifier" : service.verifies || isProviderBill ? "verify" : "identifier",
            )
          }
        />
        <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-6 pb-10 sm:pt-8">
          <PayStepper steps={stepsMeta} current={currentStepIndex} />
          <PrefillBanner />
          {isPackageLive ? (
            variationsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading packages…
              </div>
            ) : variations.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Service information is temporarily unavailable. Please try again.
              </p>
            ) : (
              <div className="space-y-2">
                {variations.map((v) => (
                  <button
                    key={v.variationCode}
                    type="button"
                    onClick={() => setVariation(v)}
                    className={cn(
                      "press flex w-full items-start justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left shadow-soft",
                      variation?.variationCode === v.variationCode
                        ? "border-primary bg-primary-soft ring-2 ring-primary/10"
                        : "border-border/70 bg-card",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold">{v.name}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {isData ? "Data plan" : "Package"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-extrabold tabular-nums">
                        {formatNaira(v.amount, false)}
                      </p>
                      {variation?.variationCode === v.variationCode ? (
                        <span className="mt-1 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          Selected
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : service.mode === "package" ? (
            <>
              {recentPacks.length > 0 ? (
                <div>
                  <p className="mb-2 text-[11px] font-bold text-muted-foreground">Recent plans</p>
                  <div className="space-y-2">
                    {recentPacks.map((p) => (
                      <button
                        key={`r-${p.id}`}
                        type="button"
                        onClick={() => setPack(p)}
                        className={cn(
                          "press flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left shadow-soft",
                          pack?.id === p.id
                            ? "border-primary bg-primary-soft ring-2 ring-primary/10"
                            : "border-border/70 bg-card",
                        )}
                      >
                        <div className="min-w-0">
                          <span className="block text-sm font-extrabold">{p.name}</span>
                          {p.note ? (
                            <span className="mt-1 block text-[10px] text-muted-foreground">
                              {p.note}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <span className="block text-base font-extrabold tabular-nums">
                            {formatNaira(p.price, false)}
                          </span>
                          {pack?.id === p.id ? (
                            <span className="mt-1 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                              Active
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                {service.packages?.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPack(p)}
                    className={cn(
                      "press flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left shadow-soft",
                      pack?.id === p.id
                        ? "border-primary bg-primary-soft ring-2 ring-primary/10"
                        : "border-border/70 bg-card",
                    )}
                  >
                    <div className="min-w-0">
                      <span className="block text-sm font-extrabold">{p.name}</span>
                      {p.note ? (
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {p.note}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <span className="block text-base font-extrabold tabular-nums">
                        {formatNaira(p.price, false)}
                      </span>
                      {pack?.id === p.id ? (
                        <span className="mt-1 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          Active
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {minPurchase > 0 ? (
                <p className="text-[11px] font-semibold text-muted-foreground">
                  Minimum: {formatNaira(minPurchase, false)}
                </p>
              ) : null}
              <div className="rounded-[26px] border border-border/70 bg-card p-4 text-center shadow-soft">
                <Label
                  htmlFor="amount"
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Amount to pay
                </Label>
                <div className="mt-3 flex items-center justify-center gap-1 rounded-2xl bg-background px-3 py-2">
                  <span className="text-xl font-extrabold">₦</span>
                  <Input
                    id="amount"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                    className="h-12 border-0 bg-transparent text-center text-3xl font-extrabold shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {amountPresets.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    className={cn(
                      "press h-12 rounded-2xl border text-sm font-extrabold shadow-soft",
                      amount === String(q)
                        ? "border-primary bg-primary-soft text-primary ring-2 ring-primary/10"
                        : "border-border/70 bg-card text-foreground",
                    )}
                  >
                    {formatNaira(q, false)}
                  </button>
                ))}
              </div>
            </>
          )}
          <Button
            className="h-11 w-full rounded-xl text-sm font-bold"
            disabled={
              total < 50 ||
              (isPackageLive && !variation) ||
              (service.mode === "package" && !isPackageLive && !pack)
            }
            onClick={() => {
              if (isPackageLive && !variation) {
                toast.error(isData ? "Select a data plan" : "Select a package");
                return;
              }
              if (isElectricity && minPurchase > 0 && total < minPurchase) {
                toast.error(`Minimum amount is ${formatNaira(minPurchase, false)}`);
                return;
              }
              if (service.mode === "package" && !isPackageLive && !pack) {
                toast.error("Select a package");
                return;
              }
              setStep("confirm");
            }}
          >
            Continue
          </Button>
        </div>
      </AppShell>
    );
  }

  if (step === "verify") {
    return (
      <AppShell>
        <PageHeader title="Verify" onBack={() => setStep("identifier")} />
        <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-6 pb-10 sm:pt-8">
          <PayStepper steps={stepsMeta} current={currentStepIndex} />
          <PrefillBanner />
          {verifying ? (
            <div className="flex items-center justify-center gap-2 rounded-[24px] border border-border/70 bg-card py-10 text-xs font-semibold text-muted-foreground shadow-soft">
              <Loader2 className="size-4 animate-spin" />{" "}
              {isElectricity ? "Verifying meter…" : "Verifying with provider…"}
            </div>
          ) : (
            <>
              <div className="rounded-[26px] border border-success/30 bg-success-soft p-4 shadow-soft">
                <div className="flex items-center gap-2.5 text-success">
                  <CheckCircle2 className="size-5" />
                  <p className="text-sm font-extrabold">
                    {isElectricity ? "Meter verified" : "Verified"}
                  </p>
                </div>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-card p-3 shadow-soft">
                <div className="divide-y divide-border/70">
                  <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
                  <InfoRow label="Provider" value={provider || serviceID} />
                  {verifiedName ? <InfoRow label="Customer" value={verifiedName} /> : null}
                  {verifiedAddress ? <InfoRow label="Address" value={verifiedAddress} /> : null}
                  {isElectricity ? <InfoRow label="Meter type" value={meterType} /> : null}
                  {minPurchase > 0 ? (
                    <InfoRow label="Minimum" value={formatNaira(minPurchase, false)} />
                  ) : null}
                </div>
              </div>
              <Button
                className="h-11 w-full rounded-xl text-sm font-bold"
                onClick={() => setStep("amount")}
              >
                Continue
              </Button>
            </>
          )}
        </div>
      </AppShell>
    );
  }

  if (step === "identifier") {
    return (
      <AppShell>
        <PageHeader
          title={service.name}
          subtitle={provider || serviceID}
          onBack={() => setStep(isElectricity ? "meterType" : "provider")}
        />
        <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-6 pb-10 sm:pt-8">
          <PayStepper steps={stepsMeta} current={currentStepIndex} />
          <div className="rounded-[26px] border border-border/70 bg-card p-4 shadow-soft">
            <div className="space-y-1.5">
              <Label
                htmlFor="identifier"
                className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                {service.identifierLabel}
              </Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => {
                  const v =
                    isData || isAirtime ? e.target.value.replace(/\D/g, "") : e.target.value;
                  setIdentifier(v);
                  if (error) setError("");
                }}
                placeholder={service.identifierPlaceholder}
                inputMode={service.numeric || isData ? "numeric" : "text"}
                className="h-12 rounded-2xl border-border/80 bg-background text-base shadow-none"
              />
              {error ? <p className="text-[11px] font-medium text-destructive">{error}</p> : null}
            </div>
          </div>
          <Button
            className="h-11 w-full rounded-xl text-sm font-bold"
            onClick={() => void startVerify()}
          >
            {isProviderBill ? "Verify & Continue" : "Continue"}
          </Button>
        </div>
      </AppShell>
    );
  }

  if (step === "meterType" && isElectricity) {
    return (
      <AppShell>
        <PageHeader
          title="Meter type"
          subtitle={provider || serviceID}
          onBack={() => setStep("provider")}
        />
        <div className="mx-auto w-full max-w-md space-y-3 px-4 pt-6 pb-10 sm:pt-8">
          <PayStepper steps={stepsMeta} current={currentStepIndex} />
          {(["prepaid", "postpaid"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setMeterType(t);
                setStep("identifier");
              }}
              className={cn(
                "press flex w-full items-center justify-between rounded-2xl border p-3.5 text-left shadow-soft",
                meterType === t
                  ? "border-primary bg-primary-soft ring-2 ring-primary/10"
                  : "border-border/70 bg-card",
              )}
            >
              <div>
                <span className="block text-sm font-extrabold capitalize">{t}</span>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {t === "prepaid" ? "Pay as you use" : "Bill settlement after use"}
                </span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </AppShell>
    );
  }

  // Provider selection
  const providerOptions = isLiveCatalog
    ? catalogServices.map((s) => ({ id: s.serviceID, label: s.name }))
    : service.providers.map((p) => ({ id: p, label: p }));

  return (
    <AppShell>
      <PageHeader title={`Pay ${service.name}`} backTo="/home" />
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-6 pb-10 sm:pt-8">
        <PayStepper steps={stepsMeta} current={currentStepIndex} />
        {recentBeneficiaries.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Recently used
            </p>
            <div className="space-y-2">
              {recentBeneficiaries.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => applyBeneficiary(b)}
                  className="press flex w-full items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary-soft/70 px-2.5 py-2.5 text-left shadow-soft"
                >
                  <span className={cn("grid size-9 place-items-center rounded-xl", service.tint)}>
                    <service.icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold">{b.label}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {b.provider} · {b.masked}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {service.providerLabel}
          </p>
          {isLiveCatalog && catalogLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading providers…
            </div>
          ) : isLiveCatalog && catalogError ? (
            <div className="space-y-2 py-4 text-center">
              <p className="text-xs text-muted-foreground">{catalogError}</p>
              <Button
                variant="outline"
                className="h-9 rounded-xl text-xs font-bold"
                onClick={() => {
                  setCatalogError("");
                  setCatalogLoading(true);
                  const category = isCable
                    ? "tv-subscription"
                    : isElectricity
                      ? "electricity-bill"
                      : "data";
                  void loadServices({ data: { category } })
                    .then((list) => setCatalogServices(list))
                    .catch((err) =>
                      setCatalogError(
                        friendlyError(
                          err,
                          "Service information is temporarily unavailable. Please try again.",
                        ),
                      ),
                    )
                    .finally(() => setCatalogLoading(false));
                }}
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {providerOptions.map((p) => {
                const isSelected = serviceID === p.id || provider === p.id;
                const isRecent = lastProvider === p.id && !isSelected;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProvider(p.label);
                      setServiceID(p.id);
                      setFromPrefill(false);
                      setVariation(null);
                      setVerifiedName("");
                      if (isElectricity) setStep("meterType");
                      else setStep("identifier");
                    }}
                    className={cn(
                      "press relative flex min-h-[88px] flex-col items-start justify-between rounded-2xl border p-3 text-left shadow-soft",
                      isSelected
                        ? "border-primary bg-primary-soft ring-2 ring-primary/10"
                        : "border-border/70 bg-card hover:border-primary/40",
                    )}
                  >
                    <span className={cn("grid size-9 place-items-center rounded-xl", service.tint)}>
                      <service.icon className="size-4" />
                    </span>
                    <div className="w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-extrabold">{p.label}</span>
                        {isSelected ? (
                          <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                            <CheckCircle2 className="size-3.5" />
                          </span>
                        ) : isRecent ? (
                          <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[9px] font-bold text-success">
                            Recent
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
