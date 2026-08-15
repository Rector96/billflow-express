RESTORE_FROM_LOCALimport { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { PageHeader } from "@/components/app/page-header";
import { InfoRow } from "@/components/app/ui-bits";
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
      if (isAirtime) {
        const res = await buyAirtime({
          data: {
            network: provider,
            phone: identifier.trim(),
            amount: total,
            pin: authorizedPin,
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
            phone: profile.phone || undefined,
            customerName: verifiedName || undefined,
            subscriptionType: "change",
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
            phone: profile.phone || undefined,
            customerName: verifiedName || undefined,
            minAmount: minPurchase,
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

      const reference = await payBill({
        service: service.name,
        serviceSlug: service.slug,
        provider,
        product: pack?.name,
        amount: total,
        identifier: identifier.trim(),
        status: "pending",
        title: `${service.name} Payment`,
        customer: service.customerName,
        pin: authorizedPin,
      });
      setTxId(reference);
      setOutcome("successful");
      setStep("result");
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
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-primary-soft/50 px-2.5 py-2">
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
          <div className="flex flex-col items-center gap-1.5 text-center">
            <span className={cn("grid size-14 place-items-center rounded-full", map.cls)}>
              <map.Icon className="size-7" />
            </span>
            <h1 className="text-lg font-extrabold">{map.title}</h1>
            <p className="max-w-xs text-xs text-muted-foreground">{map.body}</p>
            <p className="text-2xl font-extrabold tabular-nums">{formatNaira(total, false)}</p>
          </div>

          <div className="mt-3 divide-y rounded-xl border border-border/70 bg-card px-3 py-0.5">
            <InfoRow
              label="Service"
              value={`${provider || serviceID} ${variation?.name || pack?.name || service.name}`}
            />
            <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
            {verifiedName ? <InfoRow label="Customer" value={verifiedName} /> : null}
            {isElectricity ? <InfoRow label="Meter type" value={meterType} /> : null}
            <InfoRow label="Amount" value={formatNaira(total)} />
            {token ? (
              <div className="flex items-center justify-between gap-2 py-2">
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
              <div className="flex items-center justify-between gap-2 py-2">
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
              <div className="flex items-center justify-between gap-2 py-2">
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
              <div className="flex items-center justify-between gap-2 py-2">
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

          <div className="mt-3 space-y-2">
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
                {(isAirtime || isProviderBill || isData) ? (
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
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
          <Loader2 className="size-10 animate-spin text-primary" />
          <h1 className="text-lg font-extrabold">Processing your payment…</h1>
          <p className="max-w-xs text-xs text-muted-foreground">
            Please don't close this page until we finish verifying.
          </p>
          <p className="text-base font-extrabold tabular-nums">{formatNaira(total, false)}</p>
        </div>
      </AppShell>
    );
  }

  if (step === "pin") {
    return (
      <AppShell>
        <PageHeader title="Enter Transaction PIN" onBack={() => setStep("confirm")} />
        <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-md flex-col justify-center px-4 py-8 sm:min-h-[calc(100dvh-8rem)]">
          <p className="text-center text-xs text-muted-foreground">
            Enter your 4-digit PIN to authorize this payment.
          </p>
          <div className="mt-8">
            <PinPad value={pin} onChange={setPin} />
          </div>
          <Button
            className="mt-8 h-11 w-full rounded-xl text-sm font-bold"
            disabled={pin.length < 4 || payingLock.current}
            onClick={() => {
              if (payingLock.current || pin.length < 4) return;
              const authorized = pin;
              setPin("");
              void runPayment(authorized);
            }}
          >
            Confirm
          </Button>
        </div>
      </AppShell>
    );
  }

  if (step === "confirm") {
    const insufficient = total > balance;
    return (
      <AppShell>
        <PageHeader title="Confirm Payment" onBack={() => setStep("amount")} />
        <div className="mx-auto w-full max-w-md space-y-3 px-4 pt-6 pb-10 sm:pt-8">
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-card p-4">
            <span className={cn("grid size-10 place-items-center rounded-xl", service.tint)}>
              <service.icon className="size-5" />
            </span>
            <p className="text-xs font-bold">
              {provider || serviceID} {service.name}
            </p>
            <p className="text-2xl font-extrabold tabular-nums">{formatNaira(total, false)}</p>
          </div>

          <div className="divide-y rounded-xl border border-border/70 bg-card px-3 py-1">
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

          {insufficient ? (
            <div className="flex items-start gap-2 rounded-xl bg-destructive-soft p-2.5 text-destructive">
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
        <div className="mx-auto w-full max-w-md space-y-3 px-4 pt-6 pb-10 sm:pt-8">
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
              <div className="space-y-1.5">
                {variations.map((v) => (
                  <button
                    key={v.variationCode}
                    type="button"
                    onClick={() => setVariation(v)}
                    className={cn(
                      "press flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left",
                      variation?.variationCode === v.variationCode
                        ? "border-primary bg-primary-soft"
                        : "border-border/70 bg-card",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-bold">{v.name}</span>
                    </span>
                    <span className="text-xs font-extrabold">{formatNaira(v.amount, false)}</span>
                  </button>
                ))}
              </div>
            )
          ) : service.mode === "package" ? (
            <>
              {recentPacks.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">Recent plans</p>
                  <div className="space-y-1.5">
                    {recentPacks.map((p) => (
                      <button
                        key={`r-${p.id}`}
                        type="button"
                        onClick={() => setPack(p)}
                        className={cn(
                          "press flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left",
                          pack?.id === p.id ? "border-primary bg-primary-soft" : "border-border/70 bg-card",
                        )}
                      >
                        <span className="block text-xs font-bold">{p.name}</span>
                        <span className="text-xs font-extrabold">{formatNaira(p.price, false)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-1.5">
                {service.packages?.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPack(p)}
                    className={cn(
                      "press flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left",
                      pack?.id === p.id ? "border-primary bg-primary-soft" : "border-border/70 bg-card",
                    )}
                  >
                    <span className="block text-xs font-bold">{p.name}</span>
                    <span className="text-xs font-extrabold">{formatNaira(p.price, false)}</span>
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
              <div className="rounded-xl border border-border/70 bg-card p-4 text-center">
                <Label htmlFor="amount" className="text-[10px] text-muted-foreground">
                  Amount to pay
                </Label>
                <div className="mt-1 flex items-center justify-center gap-1">
                  <span className="text-xl font-extrabold">₦</span>
                  <Input
                    id="amount"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                    className="h-12 border-0 bg-transparent text-center text-2xl font-extrabold shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {amountPresets.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    className={cn(
                      "press h-9 rounded-lg border text-[11px] font-bold",
                      amount === String(q)
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border/70 bg-card",
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
        <div className="mx-auto w-full max-w-md space-y-3 px-4 pt-6 pb-10 sm:pt-8">
          <PrefillBanner />
          {verifying ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs font-semibold text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {isElectricity ? "Verifying meter…" : "Verifying with provider…"}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-success-soft p-2.5 text-success">
                <CheckCircle2 className="size-4" />
                <p className="text-xs font-bold">{isElectricity ? "Meter Verified" : "Verified"}</p>
              </div>
              <div className="divide-y rounded-xl border border-border/70 bg-card px-3 py-1">
                <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
                <InfoRow label="Provider" value={provider || serviceID} />
                {verifiedName ? <InfoRow label="Customer" value={verifiedName} /> : null}
                {verifiedAddress ? <InfoRow label="Address" value={verifiedAddress} /> : null}
                {isElectricity ? <InfoRow label="Meter type" value={meterType} /> : null}
                {minPurchase > 0 ? (
                  <InfoRow label="Minimum" value={formatNaira(minPurchase, false)} />
                ) : null}
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
        <div className="mx-auto w-full max-w-md space-y-3 px-4 pt-6 pb-10 sm:pt-8">
          <div className="space-y-1.5">
            <Label htmlFor="identifier" className="text-xs">
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
              className="h-11 rounded-xl bg-card"
            />
            {error ? <p className="text-[11px] font-medium text-destructive">{error}</p> : null}
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
        <div className="mx-auto w-full max-w-md space-y-1.5 px-4 pt-6 pb-10 sm:pt-8">
          {(["prepaid", "postpaid"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setMeterType(t);
                setStep("identifier");
              }}
              className={cn(
                "press flex w-full items-center justify-between rounded-xl border bg-card p-3 text-left",
                meterType === t ? "border-primary/60" : "border-border/70",
              )}
            >
              <span className="text-xs font-bold capitalize">{t}</span>
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
      <div className="mx-auto w-full max-w-md space-y-3 px-4 pt-6 pb-10 sm:pt-8">
        {recentBeneficiaries.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">Saved</p>
            <div className="space-y-1.5">
              {recentBeneficiaries.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => applyBeneficiary(b)}
                  className="press flex w-full items-center gap-2.5 rounded-xl border border-border/70 bg-card px-2.5 py-2 text-left"
                >
                  <span className={cn("grid size-8 place-items-center rounded-lg", service.tint)}>
                    <service.icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{b.label}</p>
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
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">{service.providerLabel}</p>
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
            <div className="space-y-1.5">
              {providerOptions.map((p) => (
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
                    "press flex w-full items-center gap-2.5 rounded-xl border bg-card p-2.5 text-left",
                    serviceID === p.id || provider === p.id || lastProvider === p.id
                      ? "border-primary/60"
                      : "border-border/70",
                  )}
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", service.tint)}>
                    <service.icon className="size-3.5" />
                  </span>
                  <span className="flex-1 text-xs font-bold">{p.label}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
