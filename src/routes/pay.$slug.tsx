
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { ExamPinsFlow } from "@/components/app/exam-pins-flow";
import { PageHeader } from "@/components/app/page-header";
import { InfoRow } from "@/components/app/ui-bits";
import { PayStepBody, PayStepper, type PayStepMeta } from "@/components/app/pay-step";
import { PinPad } from "@/components/app/pin-pad";
import { DataPlanPicker } from "@/components/app/data-plan-picker";
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
import {
  formatNaira,
  getService,
  maskTail,
  type Package,
  type TxStatus,
} from "@/lib/mock-data";
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
    if (typeof s["amount"] === "number" && Number.isFinite(s["amount"])) out.amount = s["amount"] as number;
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

function PayFlow() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const savedId = search.saved;
  const navigate = useNavigate();
  const { balance, saved, transactions, refresh, profile } = useApp();
  const isEducationBlocked = slug === "education";
  const isExamPins = slug === "exam-pins";
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
  const payCtaRef = useRef<HTMLDivElement | null>(null);

  const recentBeneficiaries = useMemo(
    () => (service ? recentSavedForService(service.slug, saved, 3) : []),
    [service, saved],
  );
  const amountPresets = useMemo(
    () =>
      service
        ? recentAmountsForService(service.slug, transactions, service.quickAmounts, 4)
        : [],
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
    if (savedItem || (prefillProvider && prefillIdentifier)) return isProviderBill ? "identifier" : "verify";
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
  const [airtimeRequestId, setAirtimeRequestId] = useState(() => `airtime-${crypto.randomUUID()}`);
  const [paymentRequestId, setPaymentRequestId] = useState(() => `bill-${crypto.randomUUID()}`);
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
    isPackageLive && variation
      ? variation.amount
      : pack
        ? pack.price
        : Number(amount || 0);

  // Load live catalogue for cable / electricity / data
  useEffect(() => {
    if (!isLiveCatalog) return;
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const category = isCable
          ? "tv-subscription"
          : isElectricity
            ? "electricity-bill"
            : "data";
        const list = await loadServices({ data: { category } });
        if (!cancelled) setCatalogServices(list);
      } catch (err) {
        if (!cancelled) {
          setCatalogError(
            friendlyError(err, "Service information is temporarily unavailable. Please try again."),
          );
          setCatalogServices([]);
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLiveCatalog, isCable, isElectricity, loadServices]);

  // Load packages when cable / data provider selected
  useEffect(() => {
    if (!isPackageLive || !serviceID) return;
    let cancelled = false;
    (async () => {
      setVariationsLoading(true);
      try {
        const list = await loadVariations({ data: { serviceID } });
        if (!cancelled) setVariations(list);
      } catch (err) {
        if (!cancelled) {
          setVariations([]);
          toast.error(friendlyError(err, "Could not load packages."));
        }
      } finally {
        if (!cancelled) setVariationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPackageLive, serviceID, loadVariations]);

  if (isEducationBlocked) {
    return (
      <AppShell>
        <PageHeader title="Education payments unavailable" backTo="/services" />
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Education payments are currently unavailable
          </p>
          <Button className="mt-5 h-11 rounded-xl font-bold" asChild>
            <Link to="/services">Back to services</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (isExamPins) return <ExamPinsFlow />;

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
          setVerifying(false);
          setStep("identifier");
          toast.error(
            isElectricity
              ? "Meter could not be confirmed. No customer name returned. Check the meter number and try again."
              : "Customer could not be confirmed. Check the number and try again.",
          );
          return;
        }
        setVerifiedName(name);
        setVerifiedAddress(res.address ?? "");
        setMinPurchase(res.minPurchaseAmount ?? 0);
        setVerifying(false);
      } catch (err) {
        setVerifying(false);
        setStep("identifier");
        toast.error(friendlyError(err, "Could not verify. Check the number and try again."));
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
      if (!isAirtime && !isData && !isCable && !isElectricity) {
        throw new Error("This service is not available yet.");
      }
      if (isAirtime) {
        const res = await buyAirtime({
          data: {
            network: provider,
            phone: identifier.trim(),
            amount: total,
            pin: authorizedPin,
            requestId: airtimeRequestId,
          },
        });
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
        const res = await buyData({
          data: {
            serviceID: serviceID || provider,
            phone: displayNgPhone(identifier),
            variationCode: variation.variationCode,
            pin: authorizedPin,
            requestId: paymentRequestId,
          },
        });
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
        const res = await buyCable({
          data: {
            serviceID: serviceID || provider,
            billersCode: identifier.trim(),
            variationCode: variation.variationCode,
            amount: Math.round(variation.amount),
            pin: authorizedPin,
            ...(profile.phone ? { phone: profile.phone } : {}),
            ...(verifiedName ? { customerName: verifiedName } : {}),
            subscriptionType: "change",
            requestId: paymentRequestId,
          },
        });
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
        const res = await buyElectricity({
          data: {
            serviceID: serviceID || provider,
            billersCode: identifier.trim(),
            meterType,
            amount: total,
            pin: authorizedPin,
            ...(profile.phone ? { phone: profile.phone } : {}),
            ...(verifiedName ? { customerName: verifiedName } : {}),
            minAmount: minPurchase,
            requestId: paymentRequestId,
          },
        });
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

      throw new Error("This service is not available yet.");
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't complete this payment."));
      setStep("confirm");
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
        friendlyError(
          err,
          "We couldn't confirm this payment yet. Your money is still protected.",
        ),
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
    const map = {
      successful: {
        Icon: CheckCircle2,
        cls: "bg-success-soft text-success",
        title: "Payment successful",
        body: resultMessage || `Your ${service.name.toLowerCase()} payment was successful.`,
      },
      pending: {
        Icon: Clock3,
        cls: "bg-warning-soft text-warning-foreground",
        title: "Payment is being confirmed",
        body:
          resultMessage ||
          "This is not a failure. Your money is held until the provider confirms.",
      },
      failed: {
        Icon: XCircle,
        cls: "bg-destructive-soft text-destructive",
        title: "Payment failed",
        body: resultMessage || "We couldn't complete your payment.",
      },
    }[outcome];

    return (
      <AppShell>
        <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-10">
          <div className="rounded-[28px] border border-border/70 bg-card p-4 shadow-soft sm:p-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <span
                className={cn(
                  "grid size-16 place-items-center rounded-full border-2 ring-8 ring-white shadow-soft",
                  map.cls,
                )}
              >
                <map.Icon className="size-8" />
              </span>
              <div className="space-y-1">
                <h1 className="text-xl font-extrabold tracking-tight">{map.title}</h1>
                <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{map.body}</p>
              </div>
              <div className="mt-1 rounded-2xl bg-muted px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Amount paid
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{formatNaira(total, false)}</p>
              </div>
            </div>

            <div className="mt-4 divide-y rounded-2xl border border-border/70 bg-background/50 px-3 py-1">
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
          </div>

          <div className="mt-4 space-y-2">
            {outcome === "failed" ? (
              <>
                <Button className="h-11 w-full rounded-xl font-bold" onClick={() => setStep("confirm")}>
                  Try Again
                </Button>
                <Button variant="outline" className="h-11 w-full rounded-xl font-bold" asChild>
                  <Link to="/support" search={txId ? { reference: txId } : {}}>
                    RockPay Care
                  </Link>
                </Button>
              </>
            ) : null}
            {outcome === "pending" ? (
              <>
                {isAirtime || isProviderBill || isData ? (
                  <Button className="h-11 w-full rounded-xl font-bold" onClick={() => void refreshStatus()}>
                    Refresh status
                  </Button>
                ) : null}
                <Button variant="outline" className="h-11 w-full rounded-xl font-bold" asChild>
                  <Link to="/support" search={txId ? { reference: txId } : {}}>
                    RockPay Care
                  </Link>
                </Button>
              </>
            ) : null}
            {outcome === "successful" ? (
              <>
                <Button
                  className="h-11 w-full rounded-xl font-bold"
                  onClick={() => {
                    setStep("provider");
                    setOutcome("pending");
                    setTxId("");
                    setProviderRequestId("");
                    setProviderTxId("");
                    setAirtimeRequestId(`airtime-${crypto.randomUUID()}`);
                    setPaymentRequestId(`bill-${crypto.randomUUID()}`);
                    setToken("");
                    setResultMessage("");
                    setVariation(null);
                  }}
                >
                  Buy Again
                </Button>
                {txId ? (
                  <Button variant="outline" className="h-11 w-full rounded-xl font-bold" asChild>
                    <Link to="/history/$txId" params={{ txId }}>
                      View Transaction
                    </Link>
                  </Button>
                ) : null}
                <Button variant="ghost" className="h-10 w-full text-xs font-bold text-muted-foreground" asChild>
                  <Link to="/support" search={txId ? { reference: txId } : {}}>
                    RockPay Care
                  </Link>
                </Button>
              </>
            ) : null}
            <Button variant="ghost" className="h-10 w-full text-xs font-bold" onClick={() => navigate({ to: "/home" })}>
              {outcome === "successful" ? "Done" : "Back Home"}
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (step === "processing") {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70dvh] w-full max-w-md items-center justify-center px-4 py-10">
          <div className="w-full rounded-[30px] border border-border/70 bg-card p-5 text-center shadow-soft">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary-soft text-primary ring-8 ring-primary/5">
              <Loader2 className="size-8 animate-spin" />
            </div>
            <h1 className="mt-5 text-xl font-extrabold tracking-tight">Processing your payment</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Please keep this screen open while we verify and complete your transaction.
            </p>
            <div className="mt-5 rounded-2xl bg-muted px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Payment amount
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{formatNaira(total, false)}</p>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-warning-soft px-3 py-2 text-left text-warning-foreground">
              <Clock3 className="size-4 shrink-0" />
              <p className="text-[11px] font-semibold">This can take a few moments depending on network confirmation.</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (step === "pin") {
    return (
      <AppShell>
        <PageHeader title="Enter Transaction PIN" onBack={() => setStep("confirm")} />
        <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-md flex-col justify-center px-4 py-8 sm:min-h-[calc(100dvh-8rem)]">
          <div className="rounded-[26px] border border-border/70 bg-card p-4 shadow-soft sm:p-5">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-primary-soft px-3 py-2.5 text-left">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Amount
                </p>
                <p className="mt-1 text-lg font-extrabold tabular-nums">{formatNaira(total, false)}</p>
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
          <div className="rounded-[28px] border border-border/70 bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", service.tint)}>
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
                <p className="mt-1 text-lg font-extrabold tabular-nums">{formatNaira(total, false)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-card p-3 shadow-soft">
            <div className="divide-y divide-border/70">
              <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
              {verifiedName ? <InfoRow label="Customer" value={verifiedName} /> : null}
              {verifiedAddress ? <InfoRow label="Address" value={verifiedAddress} /> : null}
              {isElectricity ? <InfoRow label="Meter type" value={meterType} /> : null}
              {variation ? <InfoRow label={isData ? "Data plan" : "Package"} value={variation.name} /> : null}
              {pack ? <InfoRow label="Package" value={`${pack.name} · ${formatNaira(pack.price, false)}`} /> : null}
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
              <Link to="/wallet/fund" search={{}}>Fund Wallet</Link>
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
              isData
                ? "identifier"
                : service.verifies || isProviderBill
                  ? "verify"
                  : "identifier",
            )
          }
        />
        <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-6 pb-10 sm:pt-8">
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
            ) : isData ? (
              <DataPlanPicker
                plans={variations}
                selectedCode={variation?.variationCode}
                networkLabel={provider || serviceID}
                phoneLabel={identifier}
                onSelect={(v) => {
                  setVariation(v);
                  window.setTimeout(() => {
                    payCtaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 80);
                }}
              />
            ) : (
              <div className="space-y-2">
                {variations.map((v) => (
                  <button
                    key={v.variationCode}
                    type="button"
                    onClick={() => {
                      setVariation(v);
                      window.setTimeout(() => {
                        payCtaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 80);
                    }}
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
                        Package
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-extrabold tabular-nums">{formatNaira(v.amount, false)}</p>
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
                        onClick={() => {
                      setPack(p);
                      window.setTimeout(() => {
                        payCtaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 80);
                    }}
                        className={cn(
                          "press flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left shadow-soft",
                          pack?.id === p.id ? "border-primary bg-primary-soft ring-2 ring-primary/10" : "border-border/70 bg-card",
                        )}
                      >
                        <div className="min-w-0">
                          <span className="block text-sm font-extrabold">{p.name}</span>
                          {p.note ? <span className="mt-1 block text-[10px] text-muted-foreground">{p.note}</span> : null}
                        </div>
                        <div className="text-right">
                          <span className="block text-base font-extrabold tabular-nums">{formatNaira(p.price, false)}</span>
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
                    onClick={() => {
                      setPack(p);
                      window.setTimeout(() => {
                        payCtaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 80);
                    }}
                    className={cn(
                      "press flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left shadow-soft",
                      pack?.id === p.id ? "border-primary bg-primary-soft ring-2 ring-primary/10" : "border-border/70 bg-card",
                    )}
                  >
                    <div className="min-w-0">
                      <span className="block text-sm font-extrabold">{p.name}</span>
                      {p.note ? <span className="mt-1 block text-[10px] text-muted-foreground">{p.note}</span> : null}
                    </div>
                    <div className="text-right">
                      <span className="block text-base font-extrabold tabular-nums">{formatNaira(p.price, false)}</span>
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
                <Label htmlFor="amount" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {isAirtime ? "Airtime amount" : "Amount to pay"}
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
                {isAirtime ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">Phone receives exactly this amount. No extra fee.</p>
                ) : null}
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
          <div ref={payCtaRef} className="scroll-mt-24 space-y-2 pt-1">
            {isPackageLive && variation ? (
              <div className="rounded-2xl border border-primary/20 bg-primary-soft/50 px-3.5 py-2.5 text-sm">
                <p className="text-[11px] font-semibold text-muted-foreground">Selected plan</p>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-extrabold">{variation.name}</p>
                  <p className="shrink-0 font-extrabold tabular-nums text-primary">
                    {formatNaira(variation.amount, false)}
                  </p>
                </div>
              </div>
            ) : null}
            <Button
              className="h-12 w-full rounded-2xl text-sm font-bold shadow-soft"
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
        </div>
      </AppShell>
    );
  }

  if (step === "verify") {
    return (
      <AppShell>
        <PageHeader title="Verify" onBack={() => setStep("identifier")} />
        <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-6 pb-10 sm:pt-8">
          <PrefillBanner />
          {verifying ? (
            <div className="flex items-center justify-center gap-2 rounded-[24px] border border-border/70 bg-card py-10 text-xs font-semibold text-muted-foreground shadow-soft">
              <Loader2 className="size-4 animate-spin" /> {isElectricity ? "Verifying meter…" : "Verifying with provider…"}
            </div>
          ) : (
            <>
              <div className="rounded-[26px] border border-success/30 bg-success-soft p-4 shadow-soft">
                <div className="flex items-center gap-2.5 text-success">
                  <CheckCircle2 className="size-5" />
                  <p className="text-sm font-extrabold">{isElectricity ? "Meter verified" : "Verified"}</p>
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
              <Button className="h-11 w-full rounded-xl text-sm font-bold" onClick={() => setStep("amount")}>
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
          <div className="rounded-[26px] border border-border/70 bg-card p-4 shadow-soft">
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {service.identifierLabel}
              </Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => {
                  const v = isData || isAirtime ? e.target.value.replace(/\D/g, "") : e.target.value;
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
          <Button className="h-11 w-full rounded-xl text-sm font-bold" onClick={() => void startVerify()}>
            {isProviderBill ? "Verify & Continue" : "Continue"}
          </Button>
        </div>
      </AppShell>
    );
  }

  if (step === "meterType" && isElectricity) {
    return (
      <AppShell>
        <PageHeader title="Meter type" subtitle={provider || serviceID} onBack={() => setStep("provider")} />
        <div className="mx-auto w-full max-w-md space-y-2 px-4 pt-6 pb-10 sm:pt-8">
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
