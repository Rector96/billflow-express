import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { InfoRow, RowSkeleton } from "@/components/app/ui-bits";
import { PinPad } from "@/components/app/pin-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError, useApp } from "@/lib/app-store";
import { useServerFn } from "@tanstack/react-start";
import { purchaseAirtime, requeryAirtime } from "@/lib/airtime.functions";
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
        { property: "og:title", content: `Pay ${name} — ${BRAND.name}` },
        { property: "og:description", content: "Verify, confirm and pay from your wallet." },
      ],
    };
  },
  component: PayFlow,
});

type Step =
  | "provider"
  | "identifier"
  | "verify"
  | "amount"
  | "confirm"
  | "pin"
  | "processing"
  | "result";

function PayFlow() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const savedId = search.saved;
  const navigate = useNavigate();
  const { balance, payBill, saved, transactions, refresh } = useApp();
  const service = getService(slug);
  const savedItem = saved.find((s) => s.id === savedId);
  const buyAirtime = useServerFn(purchaseAirtime);
  const checkAirtime = useServerFn(requeryAirtime);

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
      service?.mode === "package"
        ? recentPackagesForService(service.slug, transactions, service.packages, 3)
        : [],
    [service, transactions],
  );
  const lastProvider = useMemo(
    () => (service ? lastSuccessfulProvider(service.slug, transactions) : null),
    [service, transactions],
  );

  const prefillProvider = savedItem?.provider ?? search.provider ?? "";
  const prefillIdentifier = savedItem?.identifier ?? search.identifier ?? "";
  const prefillAmount =
    typeof search.amount === "number" && search.amount > 0 ? String(Math.round(search.amount)) : "";

  const initialStep: Step = (() => {
    if (savedItem || (prefillProvider && prefillIdentifier)) return "verify";
    if (prefillProvider) return "identifier";
    return "provider";
  })();

  const [step, setStep] = useState<Step>(initialStep);
  const [provider, setProvider] = useState(prefillProvider);
  const [identifier, setIdentifier] = useState(prefillIdentifier);
  const [verifying, setVerifying] = useState(initialStep === "verify");
  const [amount, setAmount] = useState(prefillAmount);
  const [pack, setPack] = useState<Package | null>(null);
  const [pin, setPin] = useState("");
  const [outcome, setOutcome] = useState<TxStatus>("successful");
  const [resultMessage, setResultMessage] = useState("");
  const [txId, setTxId] = useState("");
  const [providerRequestId, setProviderRequestId] = useState("");
  const [providerTxId, setProviderTxId] = useState("");
  const [error, setError] = useState("");
  const [fromPrefill, setFromPrefill] = useState(
    Boolean(savedItem || prefillProvider || prefillIdentifier),
  );

  const total = pack ? pack.price : Number(amount || 0);

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
    setIdentifier(b.identifier);
    setFromPrefill(true);
    setError("");
    if (b.lastAmount) setAmount(String(b.lastAmount));
    if (service.verifies) {
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
    setIdentifier("");
    setAmount("");
    setPack(null);
    setStep("provider");
  };

  const startVerify = () => {
    if (!identifier.trim() || identifier.trim().length < 5) {
      setError(`Enter a valid ${service.identifierLabel.toLowerCase()}`);
      return;
    }
    setError("");
    if (!service.verifies) {
      setStep("amount");
      return;
    }
    setVerifying(true);
    setStep("verify");
    setTimeout(() => setVerifying(false), 900);
  };

  const runPayment = async (authorizedPin: string) => {
    setStep("processing");
    setResultMessage("");
    setProviderRequestId("");
    setProviderTxId("");
    try {
      if (service.slug === "airtime") {
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
    }
  };

  const refreshAirtimeStatus = async () => {
    if (!txId) return;
    setStep("processing");
    try {
      const res = await checkAirtime({ data: { reference: txId } });
      setOutcome(res.status);
      setResultMessage(res.message);
      setProviderRequestId(res.requestId ?? providerRequestId);
      setProviderTxId(res.providerTransactionId ?? providerTxId);
      await refresh();
      setStep("result");
    } catch (err) {
      toast.error(friendlyError(err, "Could not refresh status."));
      setStep("result");
    }
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
        title: service.slug === "airtime" ? "Airtime purchase successful" : "Payment Successful",
        body: resultMessage || `Your ${service.name.toLowerCase()} payment was successful.`,
      },
      pending: {
        Icon: Clock3,
        cls: "bg-warning-soft text-warning-foreground",
        title: service.slug === "airtime" ? "Confirming your Airtime…" : "Payment Pending",
        body: resultMessage || "Your payment is still being confirmed. This is not a failure.",
      },
      failed: {
        Icon: XCircle,
        cls: "bg-destructive-soft text-destructive",
        title: service.slug === "airtime" ? "Airtime purchase failed" : "Payment Failed",
        body: resultMessage || "We couldn't complete your payment.",
      },
    }[outcome];

    return (
      <AppShell>
        <div className="px-4 py-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className={cn("grid size-16 place-items-center rounded-full", map.cls)}>
              <map.Icon className="size-8" />
            </span>
            <h1 className="text-xl font-extrabold">{map.title}</h1>
            <p className="max-w-xs text-xs text-muted-foreground">{map.body}</p>
            <p className="text-2xl font-extrabold tabular-nums">{formatNaira(total, false)}</p>
          </div>

          <div className="mt-4 divide-y rounded-xl border border-border/70 bg-card px-3 py-1">
            <InfoRow label="Service" value={`${provider} ${service.name}`} />
            <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
            {pack ? <InfoRow label="Package" value={pack.name} /> : null}
            <InfoRow label="Amount" value={formatNaira(total)} />
            <InfoRow label="RockPay reference" value={txId || "—"} />
            {service.slug === "airtime" && providerRequestId ? (
              <InfoRow label="VTpass request ID" value={providerRequestId} />
            ) : null}
            {service.slug === "airtime" && providerTxId ? (
              <InfoRow label="Provider transaction" value={providerTxId} />
            ) : null}
          </div>

          <div className="mt-4 space-y-2">
            {outcome === "failed" ? (
              <>
                <Button className="h-11 w-full rounded-xl font-bold" onClick={() => setStep("confirm")}>
                  Try Again
                </Button>
                <Button variant="outline" className="h-11 w-full rounded-xl font-bold" asChild>
                  <Link to="/support" search={txId ? { reference: txId } : {}}>
                    Get help from RockPay Care
                  </Link>
                </Button>
              </>
            ) : null}
            {outcome === "pending" ? (
              <>
                {service.slug === "airtime" ? (
                  <Button className="h-11 w-full rounded-xl font-bold" onClick={() => void refreshAirtimeStatus()}>
                    Refresh status
                  </Button>
                ) : null}
                <Button variant="outline" className="h-11 w-full rounded-xl font-bold" asChild>
                  <Link to="/support" search={txId ? { reference: txId } : {}}>
                    Contact RockPay Care
                  </Link>
                </Button>
              </>
            ) : null}
            {outcome === "successful" && txId ? (
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl font-bold"
                onClick={() => {
                  const text = [
                    txId,
                    providerRequestId ? `VTpass: ${providerRequestId}` : "",
                    providerTxId ? `Provider TX: ${providerTxId}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n");
                  navigator.clipboard?.writeText(text);
                  toast.success("Reference copied");
                }}
              >
                <Copy className="size-3.5" /> Copy reference
              </Button>
            ) : null}
            <Button
              variant={outcome === "successful" ? "default" : "ghost"}
              className="h-11 w-full rounded-xl font-bold"
              onClick={() => navigate({ to: "/home" })}
            >
              {outcome === "successful" ? "Done" : "Back Home"}
            </Button>
            {outcome === "successful" && txId ? (
              <Button variant="ghost" className="h-9 w-full text-xs font-bold text-muted-foreground" asChild>
                <Link to="/support" search={{ reference: txId }}>
                  Something wrong? RockPay Care
                </Link>
              </Button>
            ) : null}
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
          <h1 className="text-lg font-extrabold">
            {service.slug === "airtime"
              ? "Processing your Airtime purchase…"
              : "Confirming your payment securely…"}
          </h1>
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
        <div className="px-4 pt-4">
          <p className="text-center text-xs text-muted-foreground">
            Enter your 4-digit PIN to authorize this payment.
          </p>
          <div className="mt-6">
            <PinPad value={pin} onChange={setPin} />
          </div>
          <Button
            className="mt-6 h-11 w-full rounded-xl text-sm font-bold"
            disabled={pin.length < 4}
            onClick={() => {
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
        <div className="space-y-3 px-4 pt-1 pb-6">
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-card p-4">
            <span className={cn("grid size-10 place-items-center rounded-xl", service.tint)}>
              <service.icon className="size-5" />
            </span>
            <p className="text-xs font-bold">
              {provider} {service.name}
            </p>
            <p className="text-2xl font-extrabold tabular-nums">{formatNaira(total, false)}</p>
          </div>

          <div className="divide-y rounded-xl border border-border/70 bg-card px-3 py-1">
            <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
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
          title={service.mode === "package" ? "Select package" : "Enter amount"}
          subtitle={`${provider} · ${maskTail(identifier) || service.name}`}
          onBack={() => setStep(service.verifies ? "verify" : "identifier")}
        />
        <div className="space-y-3 px-4 pt-1 pb-6">
          <PrefillBanner />
          {service.mode === "package" ? (
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
                        <span className="min-w-0">
                          <span className="block text-xs font-bold">{p.name}</span>
                          {p.note ? <span className="block text-[10px] text-muted-foreground">{p.note}</span> : null}
                        </span>
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
                    <span className="min-w-0">
                      <span className="block text-xs font-bold">{p.name}</span>
                      {p.note ? <span className="block text-[10px] text-muted-foreground">{p.note}</span> : null}
                    </span>
                    <span className="text-xs font-extrabold">{formatNaira(p.price, false)}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
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
            disabled={total < 50}
            onClick={() => {
              if (service.mode === "package" && !pack) {
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
        <div className="space-y-3 px-4 pt-1 pb-6">
          <PrefillBanner />
          {verifying ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs font-semibold text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Checking…
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-success-soft p-2.5 text-success">
                <CheckCircle2 className="size-4" />
                <p className="text-xs font-bold">Ready to continue</p>
              </div>
              <div className="divide-y rounded-xl border border-border/70 bg-card px-3 py-1">
                <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
                <InfoRow label="Provider" value={provider} />
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
        <PageHeader title={service.name} subtitle={provider} onBack={() => setStep("provider")} />
        <div className="space-y-3 px-4 pt-1 pb-6">
          <div className="space-y-1.5">
            <Label htmlFor="identifier" className="text-xs">
              {service.identifierLabel}
            </Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={service.identifierPlaceholder}
              inputMode={service.numeric ? "numeric" : "text"}
              className="h-11 rounded-xl bg-card"
            />
            {error ? <p className="text-[11px] font-medium text-destructive">{error}</p> : null}
          </div>
          <Button className="h-11 w-full rounded-xl text-sm font-bold" onClick={startVerify}>
            Continue
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={`Pay ${service.name}`} backTo="/home" />
      <div className="space-y-3 px-4 pt-1 pb-6">
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
          <div className="space-y-1.5">
            {service.providers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setProvider(p);
                  setFromPrefill(false);
                  setStep("identifier");
                }}
                className={cn(
                  "press flex w-full items-center gap-2.5 rounded-xl border bg-card p-2.5 text-left",
                  provider === p || lastProvider === p ? "border-primary/60" : "border-border/70",
                )}
              >
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", service.tint)}>
                  <service.icon className="size-3.5" />
                </span>
                <span className="flex-1 text-xs font-bold">{p}</span>
                {lastProvider === p ? <span className="text-[10px] font-bold text-primary">Recent</span> : null}
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
