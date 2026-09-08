import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { ExamPinsFlow } from "@/components/app/exam-pins-flow";
import { PageHeader } from "@/components/app/page-header";
import { InfoRow } from "@/components/app/ui-bits";
import { PayActionBar } from "@/components/app/pay-action-bar";
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
import { formatNaira, getService, maskTail, type TxStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

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

type PaymentSearch = { saved?: string; provider?: string; amount?: number; identifier?: string };

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

function withProviderTimeout<T>(promise: Promise<T>, timeoutMs = 60_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Provider call timed out. The transaction can be checked again from the receipt.",
            ),
          ),
        timeoutMs,
      ),
    ),
  ]);
}

export function RockPayBillFlow() {
  const { slug } = useParams({ from: "/pay/$slug" });
  const search = useSearch({ from: "/pay/$slug" }) as PaymentSearch;
  const navigate = useNavigate();
  const { balance, saved, refresh, profile } = useApp();
  const service = getService(slug);
  const savedItem = saved.find((s) => s.id === search.saved);

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

  const [step, setStep] = useState<Step>("provider");
  const [provider, setProvider] = useState(savedItem?.provider ?? search.provider ?? "");
  const [serviceID, setServiceID] = useState(savedItem?.provider ?? search.provider ?? "");
  const [identifier, setIdentifier] = useState(savedItem?.identifier ?? search.identifier ?? "");
  const [meterType, setMeterType] = useState<"prepaid" | "postpaid">("prepaid");
  const [amount, setAmount] = useState(
    typeof search.amount === "number" && search.amount > 0 ? String(Math.round(search.amount)) : "",
  );
  const [variation, setVariation] = useState<CatalogVariation | null>(null);
  const [pin, setPin] = useState("");
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [variations, setVariations] = useState<CatalogVariation[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [variationsLoading, setVariationsLoading] = useState(false);
  const [verifiedName, setVerifiedName] = useState("");
  const [verifiedAddress, setVerifiedAddress] = useState("");
  const [minPurchase, setMinPurchase] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<TxStatus>("pending");
  const [resultMessage, setResultMessage] = useState("");
  const [txId, setTxId] = useState("");
  const [providerRequestId, setProviderRequestId] = useState("");
  const [providerTxId, setProviderTxId] = useState("");
  const [token, setToken] = useState("");
  const payingLock = useRef(false);
  const refreshLock = useRef(false);

  const total = isPackageLive && variation ? variation.amount : Number(amount || 0);

  const stepsMeta: PayStepMeta[] = useMemo(() => {
    if (isElectricity)
      return [
        { key: "provider", label: "DisCo" },
        { key: "meterType", label: "Meter" },
        { key: "identifier", label: "Meter No." },
        { key: "verify", label: "Verify" },
        { key: "amount", label: "Amount" },
        { key: "confirm", label: "Review" },
      ];
    if (isCable)
      return [
        { key: "provider", label: "Provider" },
        { key: "identifier", label: "IUC" },
        { key: "verify", label: "Verify" },
        { key: "amount", label: "Package" },
        { key: "confirm", label: "Review" },
      ];
    if (isData)
      return [
        { key: "provider", label: "Network" },
        { key: "identifier", label: "Phone" },
        { key: "amount", label: "Plan" },
        { key: "confirm", label: "Review" },
      ];
    return [
      { key: "provider", label: "Network" },
      { key: "identifier", label: "Phone" },
      { key: "amount", label: "Amount" },
      { key: "confirm", label: "Review" },
    ];
  }, [isElectricity, isCable, isData]);

  const currentStep = Math.max(
    0,
    stepsMeta.findIndex(
      (item) => item.key === (step === "pin" || step === "processing" ? "confirm" : step),
    ),
  );

  useEffect(() => {
    if (!isLiveCatalog) return;
    let cancelled = false;
    setCatalogLoading(true);
    void loadServices({
      data: { category: isCable ? "tv-subscription" : isElectricity ? "electricity-bill" : "data" },
    })
      .then((list) => {
        if (!cancelled) setCatalogServices(list);
      })
      .catch((err) => {
        if (!cancelled) toast.error(friendlyError(err, "Could not load providers."));
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLiveCatalog, isCable, isElectricity, loadServices]);

  useEffect(() => {
    if (!isPackageLive || !serviceID) return;
    let cancelled = false;
    setVariationsLoading(true);
    void loadVariations({ data: { serviceID } })
      .then((list) => {
        if (!cancelled) setVariations(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setVariations([]);
          toast.error(friendlyError(err, "Could not load plans."));
        }
      })
      .finally(() => {
        if (!cancelled) setVariationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isPackageLive, serviceID, loadVariations]);

  if (slug === "education") return <ExamPinsFlow entryTitle="Education" />;
  if (slug === "exam-pins") return <ExamPinsFlow entryTitle="Exam Pins" />;

  if (slug === "internet" || slug === "water" || slug === "insurance") {
    return (
      <AppShell>
        <PageHeader title={service?.name ?? "Coming soon"} backTo="/services" />
        <div className="mx-auto max-w-md px-4 py-10 text-center">
          <p className="text-sm font-bold">Coming soon</p>
          <p className="mt-2 text-xs text-muted-foreground">
            This RockPay bill service is not enabled yet.
          </p>
          <Button className="mt-5 h-11 rounded-xl font-bold" asChild>
            <Link to="/services">Back to services</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!service) {
    return (
      <AppShell>
        <PageHeader title="Service unavailable" backTo="/services" />
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          We could not find that service.
        </div>
      </AppShell>
    );
  }

  const startVerify = async () => {
    setError("");
    if (isData || isAirtime) {
      if (!isValidNgMobile(identifier)) {
        setError("Enter a valid Nigerian mobile number");
        return;
      }
      setIdentifier(displayNgPhone(identifier));
      setStep("amount");
      return;
    }
    if (!identifier.trim() || identifier.trim().length < 5) {
      setError(`Enter a valid ${service.identifierLabel.toLowerCase()}`);
      return;
    }
    if (!isProviderBill) {
      setStep("amount");
      return;
    }
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
      const name = String(res.customerName ?? "").trim();
      if (!name)
        throw new Error(
          "The provider did not return a customer name. Check the identifier and try again.",
        );
      setVerifiedName(name);
      setVerifiedAddress(String(res.address ?? "").trim());
      setMinPurchase(Number(res.minPurchaseAmount ?? 0));
      setVerifying(false);
    } catch (err) {
      setVerifying(false);
      setStep("identifier");
      toast.error(friendlyError(err, "Verification failed. Check the details and try again."));
    }
  };

  const runPayment = async (authorizedPin: string) => {
    if (payingLock.current) return;
    payingLock.current = true;
    setStep("processing");
    setOutcome("pending");
    setResultMessage("");
    setToken("");
    try {
      if (isAirtime) {
        const res = await withProviderTimeout(
          buyAirtime({
            data: {
              network: provider,
              phone: displayNgPhone(identifier),
              amount: total,
              pin: authorizedPin,
            },
          }),
        );
        setTxId(res.reference);
        setProviderRequestId(res.requestId ?? "");
        setProviderTxId(res.providerTransactionId ?? "");
        setOutcome(res.status);
        setResultMessage(res.message);
      } else if (isData) {
        if (!variation) throw new Error("Select a data plan.");
        const res = await withProviderTimeout(
          buyData({
            data: {
              serviceID: serviceID || provider,
              phone: displayNgPhone(identifier),
              variationCode: variation.variationCode,
              pin: authorizedPin,
            },
          }),
        );
        setTxId(res.reference);
        setProviderRequestId(res.requestId ?? "");
        setProviderTxId(res.providerTransactionId ?? "");
        setOutcome(res.status);
        setResultMessage(res.message);
      } else if (isCable) {
        if (!variation) throw new Error("Select a cable package.");
        const res = await withProviderTimeout(
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
        );
        setTxId(res.reference);
        setProviderRequestId(res.requestId ?? "");
        setProviderTxId(res.providerTransactionId ?? "");
        setOutcome(res.status);
        setResultMessage(res.message);
      } else if (isElectricity) {
        const res = await withProviderTimeout(
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
        );
        setTxId(res.reference);
        setProviderRequestId(res.requestId ?? "");
        setProviderTxId(res.providerTransactionId ?? "");
        setToken(res.token ?? "");
        setOutcome(res.status);
        setResultMessage(res.message);
      } else throw new Error("This bill service is not available for live payment yet.");
      await refresh();
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
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't confirm this payment yet."));
      setStep("result");
    } finally {
      refreshLock.current = false;
    }
  };

  const copy = (label: string, value: string) => {
    if (value) {
      void navigator.clipboard?.writeText(value);
      toast.success(`${label} copied`);
    }
  };

  if (step === "processing")
    return (
      <AppShell>
        <div className="flex min-h-[70dvh] items-center justify-center px-4">
          <div className="w-full max-w-md rounded-[28px] border bg-card p-7 text-center shadow-soft">
            <Loader2 className="mx-auto size-12 animate-spin text-primary" />
            <h1 className="mt-5 text-xl font-black">Processing payment</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              RockPay is communicating with the provider. Please do not submit again.
            </p>
            <p className="mt-5 text-2xl font-black">{formatNaira(total, false)}</p>
          </div>
        </div>
      </AppShell>
    );

  if (step === "result")
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-md space-y-4 px-4 py-8">
          <div className="rounded-[28px] border bg-card p-6 text-center shadow-soft">
            <span
              className={cn(
                "mx-auto grid size-16 place-items-center rounded-full",
                outcome === "successful"
                  ? "bg-success-soft text-success"
                  : outcome === "failed"
                    ? "bg-destructive-soft text-destructive"
                    : "bg-warning-soft text-warning",
              )}
            >
              {outcome === "successful" ? (
                <CheckCircle2 className="size-8" />
              ) : outcome === "failed" ? (
                <AlertCircle className="size-8" />
              ) : (
                <Clock3 className="size-8 animate-pulse" />
              )}
            </span>
            <h1 className="mt-4 text-2xl font-black">
              {outcome === "successful"
                ? "Payment successful"
                : outcome === "failed"
                  ? "Payment failed"
                  : "Payment processing"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{resultMessage}</p>
            {token ? (
              <div className="mt-5 rounded-2xl border border-primary/30 bg-primary-soft p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Electricity token
                </p>
                <p className="mt-2 break-all font-mono text-lg font-black select-all">{token}</p>
                <Button
                  variant="outline"
                  className="mt-3 rounded-xl"
                  onClick={() => copy("Token", token)}
                >
                  <Copy className="mr-2 size-4" />
                  Copy token
                </Button>
              </div>
            ) : null}
            <div className="mt-5 divide-y rounded-2xl border bg-background px-3 text-left">
              <InfoRow
                label="Service"
                value={`${provider || serviceID} ${variation?.name || service.name}`}
              />
              <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
              {verifiedName ? <InfoRow label="Customer" value={verifiedName} /> : null}
              {isElectricity ? <InfoRow label="Meter type" value={meterType} /> : null}
              <InfoRow label="Amount" value={formatNaira(total)} />
              {txId ? (
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <span className="text-[11px] text-muted-foreground">RockPay reference</span>
                  <button
                    className="font-mono text-xs font-bold text-primary"
                    onClick={() => copy("Reference", txId)}
                  >
                    {txId}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {outcome === "pending" ? (
            <Button
              className="h-12 w-full rounded-2xl font-bold"
              onClick={() => void refreshStatus()}
            >
              <RefreshCw className="mr-2 size-4" />
              Check status
            </Button>
          ) : null}
          {outcome === "failed" ? (
            <Button
              className="h-12 w-full rounded-2xl font-bold"
              onClick={() => setStep("confirm")}
            >
              <RefreshCw className="mr-2 size-4" />
              Try again
            </Button>
          ) : null}
          {txId ? (
            <Button variant="outline" className="h-11 w-full rounded-2xl font-bold" asChild>
              <Link to="/history/$txId" params={{ txId }}>
                View receipt
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" className="h-11 w-full rounded-2xl font-bold" asChild>
            <Link to="/home">Back to home</Link>
          </Button>
        </div>
      </AppShell>
    );

  if (step === "pin")
    return (
      <AppShell>
        <PageHeader title="Transaction PIN" onBack={() => setStep("confirm")} />
        <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
          <PayStepper steps={stepsMeta} current={currentStep} />
          <div className="rounded-[26px] border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between rounded-2xl bg-primary-soft px-3 py-3">
              <span className="text-xs font-bold text-muted-foreground">RockPay Wallet</span>
              <span className="text-lg font-black">{formatNaira(total, false)}</span>
            </div>
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Enter your 4-digit transaction PIN to authorize this bill payment.
            </p>
            <PinPad value={pin} onChange={setPin} />
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                disabled={pin.length < 4 || payingLock.current}
                onClick={() => {
                  const p = pin;
                  setPin("");
                  void runPayment(p);
                }}
              >
                Confirm payment
              </Button>
            </PayActionBar>
          </div>
        </div>
      </AppShell>
    );

  if (step === "confirm") {
    const insufficient = total > balance;
    return (
      <AppShell>
        <PageHeader title="Review bill" onBack={() => setStep("amount")} />
        <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
          <PayStepper steps={stepsMeta} current={currentStep} />
          <div className="rounded-[26px] border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {provider || serviceID}
                </p>
                <p className="text-base font-black">{service.name}</p>
              </div>
              <p className="text-xl font-black">{formatNaira(total, false)}</p>
            </div>
          </div>
          <div className="rounded-[24px] border bg-card px-3 shadow-soft divide-y">
            <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
            {verifiedName ? <InfoRow label="Customer" value={verifiedName} /> : null}
            {verifiedAddress ? <InfoRow label="Address" value={verifiedAddress} /> : null}
            {isElectricity ? <InfoRow label="Meter type" value={meterType} /> : null}
            {variation ? (
              <InfoRow label={isData ? "Data plan" : "Package"} value={variation.name} />
            ) : null}
            <InfoRow label="Amount" value={formatNaira(total)} />
            <InfoRow label="Payment method" value="RockPay Wallet" />
            <InfoRow label="Wallet balance" value={formatNaira(balance)} />
          </div>
          {insufficient ? (
            <div className="rounded-2xl bg-destructive-soft p-3 text-xs font-semibold text-destructive">
              Insufficient wallet balance. Fund your wallet before continuing.
            </div>
          ) : (
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                onClick={() => {
                  setPin("");
                  setStep("pin");
                }}
              >
                Confirm & Pay {formatNaira(total, false)}
              </Button>
            </PayActionBar>
          )}{" "}
          {insufficient ? (
            <Button className="h-11 w-full rounded-xl font-bold" asChild>
              <Link to="/wallet/fund" search={{}}>
                Fund Wallet
              </Link>
            </Button>
          ) : null}
        </div>
      </AppShell>
    );
  }

  if (step === "amount")
    return (
      <AppShell>
        <PageHeader
          title={isPackageLive ? "Choose plan" : "Enter amount"}
          subtitle={`${provider || serviceID} · ${maskTail(identifier)}`}
          onBack={() => setStep(isProviderBill ? "verify" : "identifier")}
        />
        <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
          <PayStepper steps={stepsMeta} current={currentStep} />
          {variationsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading plans…
            </div>
          ) : isPackageLive ? (
            <div className="space-y-2">
              {variations.map((v) => (
                <button
                  key={v.variationCode}
                  type="button"
                  onClick={() => setVariation(v)}
                  className={cn(
                    "press flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left shadow-soft",
                    variation?.variationCode === v.variationCode
                      ? "border-primary bg-primary-soft"
                      : "bg-card",
                  )}
                >
                  <span className="text-sm font-extrabold">{v.name}</span>
                  <span className="font-black">{formatNaira(v.amount, false)}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-[24px] border bg-card p-4 shadow-soft">
                <Label
                  htmlFor="bill-amount"
                  className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Amount to pay
                </Label>
                <div className="mt-2 flex items-center rounded-2xl bg-background px-3">
                  <span className="text-2xl font-black">₦</span>
                  <Input
                    id="bill-amount"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                    className="h-14 border-0 bg-transparent text-3xl font-black shadow-none focus-visible:ring-0"
                    placeholder="0"
                  />
                </div>
              </div>
              {minPurchase > 0 ? (
                <p className="text-xs font-semibold text-muted-foreground">
                  Minimum: {formatNaira(minPurchase, false)}
                </p>
              ) : null}
            </>
          )}
          <Button
            className="h-12 w-full rounded-xl font-bold"
            disabled={
              total < 50 ||
              (isPackageLive && !variation) ||
              (isElectricity && minPurchase > 0 && total < minPurchase)
            }
            onClick={() => setStep("confirm")}
          >
            Continue
          </Button>
        </div>
      </AppShell>
    );

  if (step === "verify")
    return (
      <AppShell>
        <PageHeader title="Verify customer" onBack={() => setStep("identifier")} />
        <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
          <PayStepper steps={stepsMeta} current={currentStep} />
          {verifying ? (
            <div className="rounded-2xl border bg-card py-12 text-center text-xs text-muted-foreground">
              <Loader2 className="mx-auto mb-3 size-7 animate-spin text-primary" />
              Verifying with provider…
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-success/30 bg-success-soft p-4">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="size-5" />
                  <span className="text-sm font-black">Customer verified</span>
                </div>
              </div>
              <div className="rounded-2xl border bg-card px-3 shadow-soft divide-y">
                <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
                <InfoRow label="Provider" value={provider || serviceID} />
                {verifiedName ? <InfoRow label="Customer" value={verifiedName} /> : null}
                {verifiedAddress ? <InfoRow label="Address" value={verifiedAddress} /> : null}
                {isElectricity ? <InfoRow label="Meter type" value={meterType} /> : null}
              </div>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                onClick={() => setStep("amount")}
              >
                Continue
              </Button>
            </>
          )}
        </div>
      </AppShell>
    );

  if (step === "identifier")
    return (
      <AppShell>
        <PageHeader
          title={service.identifierLabel}
          subtitle={provider || serviceID}
          onBack={() => setStep(isElectricity ? "meterType" : "provider")}
        />
        <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
          <PayStepper steps={stepsMeta} current={currentStep} />
          <div className="rounded-[26px] border bg-card p-4 shadow-soft">
            <Label
              htmlFor="bill-identifier"
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              {service.identifierLabel}
            </Label>
            <Input
              id="bill-identifier"
              value={identifier}
              onChange={(e) => {
                setIdentifier(
                  isData || isAirtime ? e.target.value.replace(/\D/g, "") : e.target.value,
                );
                setError("");
              }}
              placeholder={service.identifierPlaceholder}
              inputMode={service.numeric || isData || isAirtime ? "numeric" : "text"}
              className="mt-2 h-12 rounded-2xl"
            />
            {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          </div>
          <Button className="h-12 w-full rounded-xl font-bold" onClick={() => void startVerify()}>
            {isProviderBill ? "Verify & Continue" : "Continue"}
          </Button>
        </div>
      </AppShell>
    );

  if (step === "meterType" && isElectricity)
    return (
      <AppShell>
        <PageHeader
          title="Meter type"
          subtitle={provider || serviceID}
          onBack={() => setStep("provider")}
        />
        <div className="mx-auto w-full max-w-md space-y-3 px-4 py-6">
          <PayStepper steps={stepsMeta} current={currentStep} />
          {(["prepaid", "postpaid"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setMeterType(type);
                setStep("identifier");
              }}
              className={cn(
                "press flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left shadow-soft",
                meterType === type && "border-primary bg-primary-soft",
              )}
            >
              <div>
                <p className="text-sm font-black capitalize">{type}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {type === "prepaid"
                    ? "Receive a token after successful payment."
                    : "Pay the electricity account using the meter/account number."}
                </p>
              </div>
              <ChevronRight className="size-4" />
            </button>
          ))}
        </div>
      </AppShell>
    );

  const providerOptions = isLiveCatalog
    ? catalogServices.map((item) => ({ id: item.serviceID, label: item.name }))
    : service.providers.map((item) => ({ id: item, label: item }));
  return (
    <AppShell>
      <PageHeader title={`Pay ${service.name}`} backTo="/home" />
      <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
        <PayStepper steps={stepsMeta} current={currentStep} />
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {service.providerLabel}
          </p>
          {catalogLoading ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              <Loader2 className="mx-auto mb-2 size-5 animate-spin text-primary" />
              Loading providers…
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {providerOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setProvider(item.label);
                    setServiceID(item.id);
                    setVariation(null);
                    setVerifiedName("");
                    setVerifiedAddress("");
                    setError("");
                    setStep(isElectricity ? "meterType" : "identifier");
                  }}
                  className={cn(
                    "press flex min-h-20 items-center justify-between rounded-2xl border bg-card p-3 text-left shadow-soft",
                    serviceID === item.id && "border-primary bg-primary-soft",
                  )}
                >
                  <span className="text-sm font-black">{item.label}</span>
                  {serviceID === item.id ? (
                    <CheckCircle2 className="size-5 text-primary" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
