/**
 * Pay flow — electricity/cable direct Paystack + wallet PIN for other services.
 */
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { ExamPinsFlow } from "@/components/app/exam-pins-flow";
import { PageHeader } from "@/components/app/page-header";
import { InfoRow } from "@/components/app/ui-bits";
import { PinPad } from "@/components/app/pin-pad";
import { DataPlanPicker } from "@/components/app/data-plan-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError, useApp } from "@/lib/app-store";
import { useServerFn } from "@tanstack/react-start";
import { purchaseAirtime } from "@/lib/airtime.functions";
import {
  listVtpassServices,
  listVtpassVariations,
  purchaseCable,
  purchaseData,
  purchaseElectricity,
  verifyVtpassCustomer,
} from "@/lib/bills.functions";
import { formatNaira, getService, maskTail, type TxStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { DIRECT_PAY } from "@/lib/product-mode";
import { initializeDirectBillPay } from "@/lib/direct-bill.functions";

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
type CatalogVariation = { variationCode: string; name: string; amount: number; fixedPrice: boolean };

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

export function PayFlow() {
  const { slug } = useParams({ from: "/pay/$slug" });
  const search = useSearch({ from: "/pay/$slug" }) as {
    saved?: string;
    provider?: string;
    amount?: number;
    identifier?: string;
  };
  const navigate = useNavigate();
  const { balance, saved, refresh, profile } = useApp();
  const service = getService(slug);
  const savedItem = saved.find((s) => s.id === search.saved);

  const buyAirtime = useServerFn(purchaseAirtime);
  const loadServices = useServerFn(listVtpassServices);
  const loadVariations = useServerFn(listVtpassVariations);
  const verifyCustomer = useServerFn(verifyVtpassCustomer);
  const buyCable = useServerFn(purchaseCable);
  const buyData = useServerFn(purchaseData);
  const buyElectricity = useServerFn(purchaseElectricity);
  const initDirectPay = useServerFn(initializeDirectBillPay);

  const isAirtime = service?.slug === "airtime";
  const isCable = service?.slug === "cable";
  const isElectricity = service?.slug === "electricity";
  const isData = service?.slug === "data";
  const isProviderBill = isCable || isElectricity;
  const isLiveCatalog = isCable || isElectricity || isData;
  const isPackageLive = isCable || isData;

  const payingLock = useRef(false);
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
  const [minPurchase, setMinPurchase] = useState(0);
  const [paymentRequestId] = useState(() => `bill-${crypto.randomUUID()}`);
  const [airtimeRequestId] = useState(() => `airtime-${crypto.randomUUID()}`);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<TxStatus>("pending");
  const [resultMessage, setResultMessage] = useState("");
  const [txId, setTxId] = useState("");
  const [token, setToken] = useState("");

  const total = isPackageLive && variation ? variation.amount : Number(amount || 0);

  useEffect(() => {
    if (!isLiveCatalog) return;
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      try {
        const category = isCable ? "tv-subscription" : isElectricity ? "electricity-bill" : "data";
        const list = await loadServices({ data: { category } });
        if (!cancelled) setCatalogServices(list);
      } catch (err) {
        if (!cancelled) toast.error(friendlyError(err, "Could not load providers."));
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLiveCatalog, isCable, isElectricity, loadServices]);

  useEffect(() => {
    if (!isPackageLive || !serviceID) return;
    let cancelled = false;
    (async () => {
      setVariationsLoading(true);
      try {
        const list = await loadVariations({ data: { serviceID } });
        if (!cancelled) setVariations(list);
      } catch {
        if (!cancelled) setVariations([]);
      } finally {
        if (!cancelled) setVariationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPackageLive, serviceID, loadVariations]);

  if (slug === "education") {
    return (
      <AppShell>
        <PageHeader title="Education payments unavailable" backTo="/services" />
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">Currently unavailable</div>
      </AppShell>
    );
  }
  if (slug === "exam-pins") return <ExamPinsFlow />;
  if (!service) {
    return (
      <AppShell>
        <PageHeader title="Service unavailable" backTo="/services" />
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">We couldn&apos;t find that service.</div>
      </AppShell>
    );
  }

  const startVerify = async () => {
    if (isData) {
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
    setError("");
    if (isProviderBill) {
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
          setStep("identifier");
          toast.error("Could not verify. Check the number and try again.");
          return;
        }
        setVerifiedName(name);
        setMinPurchase(res.minPurchaseAmount ?? 0);
        setStep("amount");
      } catch (err) {
        setStep("identifier");
        toast.error(friendlyError(err, "Could not verify."));
      }
      return;
    }
    setStep("amount");
  };

  const runDirectPay = async () => {
    if (payingLock.current || (!isElectricity && !isCable)) return;
    payingLock.current = true;
    setStep("processing");
    try {
      const payload = isElectricity
        ? {
            slug: "electricity" as const,
            serviceID: serviceID || provider,
            billersCode: identifier.trim(),
            amount: total,
            meterType,
            ...(profile.phone ? { phone: profile.phone } : {}),
            ...(verifiedName ? { customerName: verifiedName } : {}),
            requestId: paymentRequestId,
          }
        : {
            slug: "cable" as const,
            serviceID: serviceID || provider,
            billersCode: identifier.trim(),
            amount: total,
            variationCode: variation!.variationCode,
            ...(profile.phone ? { phone: profile.phone } : {}),
            ...(verifiedName ? { customerName: verifiedName } : {}),
            requestId: paymentRequestId,
          };
      const res = await initDirectPay({ data: payload });
      window.location.href = res.authorizationUrl;
    } catch (err) {
      toast.error(friendlyError(err, "Could not start checkout."));
      setStep("confirm");
      payingLock.current = false;
    }
  };

  const runPayment = async (authorizedPin: string) => {
    if (payingLock.current) return;
    payingLock.current = true;
    setStep("processing");
    try {
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
        setOutcome(res.status);
        setResultMessage(res.message);
        await refresh();
        setStep("result");
        return;
      }
      if (isData) {
        if (!variation) throw new Error("Select a data plan.");
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
        setToken(res.token ?? "");
        setOutcome(res.status);
        setResultMessage(res.message);
        await refresh();
        setStep("result");
        return;
      }
      throw new Error("This service is not available yet.");
    } catch (err) {
      toast.error(friendlyError(err, "We couldn&apos;t complete this payment."));
      setStep("confirm");
    } finally {
      payingLock.current = false;
    }
  };

  if (step === "processing") {
    return (
      <AppShell>
        <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm font-bold">Processing…</p>
        </div>
      </AppShell>
    );
  }

  if (step === "result") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md space-y-4 px-4 py-10 text-center">
          <h1 className="text-xl font-extrabold">
            {outcome === "successful" ? "Successful" : outcome === "failed" ? "Failed" : "Pending"}
          </h1>
          <p className="text-sm text-muted-foreground">{resultMessage}</p>
          {token ? <p className="break-all font-mono text-lg font-bold">{token}</p> : null}
          {txId ? <p className="font-mono text-xs">{txId}</p> : null}
          <Button className="h-11 w-full rounded-xl font-bold" onClick={() => navigate({ to: "/home" })}>
            Home
          </Button>
        </div>
      </AppShell>
    );
  }

  if (step === "pin") {
    return (
      <AppShell>
        <PageHeader title="Enter PIN" onBack={() => setStep("confirm")} />
        <div className="mx-auto max-w-md space-y-4 px-4 py-6">
          <PinPad value={pin} onChange={setPin} />
          <Button
            className="h-11 w-full rounded-xl font-bold"
            disabled={pin.length < 4}
            onClick={() => {
              const p = pin;
              setPin("");
              void runPayment(p);
            }}
          >
            Confirm payment
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
        <div className="mx-auto max-w-md space-y-4 px-4 py-6">
          <div className="rounded-2xl border bg-card p-4 shadow-soft">
            <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
            {verifiedName ? <InfoRow label="Customer" value={verifiedName} /> : null}
            <InfoRow label="Amount" value={formatNaira(total, false)} />
          </div>
          {DIRECT_PAY && (isElectricity || isCable) ? (
            <Button className="h-11 w-full rounded-xl font-bold" disabled={total < 50} onClick={() => void runDirectPay()}>
              Pay {formatNaira(total, false)} securely
            </Button>
          ) : insufficient ? (
            <Button className="h-11 w-full rounded-xl font-bold" asChild>
              <Link to="/wallet/fund" search={{}}>
                Fund Wallet
              </Link>
            </Button>
          ) : (
            <Button className="h-11 w-full rounded-xl font-bold" onClick={() => setStep("pin")}>
              Confirm &amp; Pay {formatNaira(total, false)}
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
          title={isPackageLive ? "Select package" : "Enter amount"}
          onBack={() => setStep(isProviderBill ? "identifier" : "provider")}
        />
        <div className="mx-auto max-w-md space-y-4 px-4 py-6">
          {isPackageLive ? (
            variationsLoading ? (
              <p className="text-center text-xs text-muted-foreground">Loading…</p>
            ) : isData ? (
              <DataPlanPicker
                plans={variations}
                selectedCode={variation?.variationCode}
                networkLabel={provider || serviceID}
                phoneLabel={identifier}
                onSelect={(v) => setVariation(v)}
              />
            ) : (
              <div className="space-y-2">
                {variations.map((v) => (
                  <button
                    key={v.variationCode}
                    type="button"
                    onClick={() => setVariation(v)}
                    className={cn(
                      "press flex w-full items-center justify-between rounded-xl border bg-card px-3 py-3 text-left text-sm",
                      variation?.variationCode === v.variationCode && "border-primary bg-primary-soft",
                    )}
                  >
                    <span className="font-bold">{v.name}</span>
                    <span className="font-extrabold tabular-nums">{formatNaira(v.amount, false)}</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                className="h-12 rounded-xl text-lg font-bold"
                placeholder="0"
              />
              {minPurchase > 0 ? (
                <p className="text-[11px] text-muted-foreground">Minimum {formatNaira(minPurchase, false)}</p>
              ) : null}
            </div>
          )}
          <Button
            className="h-11 w-full rounded-xl font-bold"
            disabled={total < 50 || (isPackageLive && !variation)}
            onClick={() => setStep("confirm")}
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
        <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-bold">Verifying…</p>
        </div>
      </AppShell>
    );
  }

  if (step === "identifier" || step === "meterType") {
    return (
      <AppShell>
        <PageHeader
          title={isElectricity && step === "meterType" ? "Meter type" : service.identifierLabel}
          onBack={() => setStep(step === "meterType" ? "provider" : isElectricity ? "meterType" : "provider")}
        />
        <div className="mx-auto max-w-md space-y-4 px-4 py-6">
          {isElectricity && step === "meterType" ? (
            <div className="grid grid-cols-2 gap-2">
              {(["prepaid", "postpaid"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setMeterType(t);
                    setStep("identifier");
                  }}
                  className={cn(
                    "press rounded-xl border bg-card py-4 text-sm font-bold capitalize",
                    meterType === t && "border-primary bg-primary-soft",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <>
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={service.identifierPlaceholder}
                className="h-12 rounded-xl"
              />
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              <Button className="h-11 w-full rounded-xl font-bold" onClick={() => void startVerify()}>
                Continue
              </Button>
            </>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={service.name} backTo="/services" />
      <div className="mx-auto max-w-md space-y-3 px-4 py-6">
        {catalogLoading ? (
          <p className="text-center text-xs text-muted-foreground">Loading providers…</p>
        ) : (
          (isLiveCatalog ? catalogServices : service.providers.map((p) => ({ serviceID: p, name: p }))).map(
            (s: { serviceID: string; name: string }) => (
              <button
                key={s.serviceID}
                type="button"
                onClick={() => {
                  setProvider(s.name);
                  setServiceID(s.serviceID);
                  setStep(isElectricity ? "meterType" : "identifier");
                }}
                className="press flex w-full items-center rounded-xl border bg-card px-4 py-3 text-left text-sm font-bold shadow-soft"
              >
                {s.name}
              </button>
            ),
          )
        )}
      </div>
    </AppShell>
  );
}
