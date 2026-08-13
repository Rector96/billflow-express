import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  HelpCircle,
  Loader2,
  Share2,
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
import {
  DEMO_PIN,
  formatNaira,
  getService,
  maskTail,
  type Package,
  type TxStatus,
} from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Search = { saved?: string | undefined };

export const Route = createFileRoute("/pay/$slug")({
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s["saved"] === "string" ? { saved: s["saved"] } : {},
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
  const { saved: savedId } = Route.useSearch();
  const navigate = useNavigate();
  const { balance, payBill, saved } = useApp();
  const service = getService(slug);
  const savedItem = saved.find((s) => s.id === savedId);

  const [step, setStep] = useState<Step>(savedItem ? "verify" : "provider");
  const [provider, setProvider] = useState(savedItem?.provider ?? "");
  const [identifier, setIdentifier] = useState(savedItem?.identifier ?? "");
  const [verifying, setVerifying] = useState(Boolean(savedItem));
  const [amount, setAmount] = useState("");
  const [pack, setPack] = useState<Package | null>(null);
  const [pin, setPin] = useState("");
  const [outcome, setOutcome] = useState<TxStatus>("successful");
  const [txId, setTxId] = useState("");
  const [error, setError] = useState("");

  const total = pack ? pack.price : Number(amount || 0);
  const now = useMemo(() => new Date(), []);
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });

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
    setTimeout(() => setVerifying(false), 1500);
  };

  const runPayment = async () => {
    setStep("processing");
    try {
      const reference = await payBill({
        service: service.name,
        serviceSlug: service.slug,
        provider,
        product: pack?.name,
        amount: total,
        identifier: identifier.trim(),
        status: outcome,
        title: `${service.name} Payment`,
        customer: service.customerName,
        token:
          outcome === "successful" && service.slug === "electricity"
            ? "1234 5678 9012 3456"
            : undefined,
      });
      setTxId(reference);
      setStep("result");
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't complete this payment."));
      setStep("confirm");
    }
  };

  /* ---------- RESULT ---------- */
  if (step === "result") {
    const map = {
      successful: {
        Icon: CheckCircle2,
        cls: "bg-success-soft text-success",
        title: "Payment Successful",
        body: `Your ${service.name.toLowerCase()} payment was successful.`,
      },
      pending: {
        Icon: Clock3,
        cls: "bg-warning-soft text-warning-foreground",
        title: "Payment Pending",
        body: "Your payment is still being processed.",
      },
      failed: {
        Icon: XCircle,
        cls: "bg-destructive-soft text-destructive",
        title: "Payment Failed",
        body: "We couldn't complete your payment.",
      },
    }[outcome];

    return (
      <AppShell>
        <div className="px-4 py-8">
          <div className="animate-in fade-in flex flex-col items-center gap-3 text-center">
            <span className={cn("animate-in zoom-in grid size-20 place-items-center rounded-full", map.cls)}>
              <map.Icon className="size-10" />
            </span>
            <h1 className="text-2xl font-extrabold">{map.title}</h1>
            <p className="max-w-xs text-sm text-muted-foreground">{map.body}</p>
            <p className="text-3xl font-extrabold tabular-nums">{formatNaira(total, false)}</p>
          </div>

          <div className="mt-6 divide-y rounded-2xl border bg-card px-4 py-2 shadow-card">
            <InfoRow label="Service" value={`${provider} ${service.name}`} />
            {service.customerName ? <InfoRow label="Customer" value={service.customerName} /> : null}
            <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
            {pack ? <InfoRow label="Package" value={pack.name} /> : null}
            <InfoRow label="Amount" value={formatNaira(total)} />
            <InfoRow label="Payment method" value="Wallet Balance" />
            <InfoRow label="Date" value={`${dateStr} • ${timeStr}`} />
            <InfoRow label="Transaction ID" value={txId} />
          </div>

          {outcome === "successful" && service.slug === "electricity" ? (
            <div className="mt-4 rounded-2xl border border-dashed bg-primary-soft p-4 text-center">
              <p className="text-xs font-semibold text-muted-foreground">Electricity Token</p>
              <p className="mt-1 text-xl font-extrabold tracking-[0.15em]">1234 5678 9012 3456</p>
              <Button
                variant="outline"
                className="press mt-3 h-11 w-full rounded-xl font-bold"
                onClick={() => {
                  navigator.clipboard?.writeText("1234567890123456");
                  toast.success("Token copied");
                }}
              >
                <Copy className="size-4" /> Copy Token
              </Button>
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {outcome === "failed" ? (
              <>
                <Button className="h-13 w-full rounded-2xl font-bold" onClick={() => setStep("confirm")}>
                  Try Again
                </Button>
                <Button variant="outline" className="h-13 w-full rounded-2xl font-bold" asChild>
                  <Link to="/support">Contact Support</Link>
                </Button>
              </>
            ) : null}
            {outcome === "pending" ? (
              <>
                <Button
                  className="h-13 w-full rounded-2xl font-bold"
                  onClick={() => toast.info("Status unchanged — still pending")}
                >
                  Refresh Status
                </Button>
                <Button variant="outline" className="h-13 w-full rounded-2xl font-bold" asChild>
                  <Link to="/history/$txId" params={{ txId }}>
                    View Transaction
                  </Link>
                </Button>
              </>
            ) : null}
            {outcome === "successful" ? (
              <Button
                variant="outline"
                className="h-13 w-full rounded-2xl font-bold"
                onClick={() => toast.success("Receipt shared (demo)")}
              >
                <Share2 className="size-4" /> Share Receipt
              </Button>
            ) : null}
            <Button
              variant={outcome === "successful" ? "default" : "ghost"}
              className="h-13 w-full rounded-2xl font-bold"
              onClick={() => navigate({ to: "/home" })}
            >
              {outcome === "successful" ? "Done" : "Back Home"}
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ---------- PROCESSING ---------- */
  if (step === "processing") {
    return (
      <AppShell>
        <div className="flex min-h-[75dvh] flex-col items-center justify-center gap-4 px-6 text-center">
          <Loader2 className="size-12 animate-spin text-primary" />
          <h1 className="text-xl font-extrabold">Processing Payment</h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            Your payment is being processed. Please don't close this page.
          </p>
          <div className="mt-2 rounded-2xl border bg-card px-6 py-3 text-center shadow-card">
            <p className="text-lg font-extrabold">{formatNaira(total, false)}</p>
            <p className="text-xs text-muted-foreground">
              {provider} {service.name}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ---------- PIN ---------- */
  if (step === "pin") {
    return (
      <AppShell>
        <PageHeader title="Enter Transaction PIN" onBack={() => setStep("confirm")} />
        <div className="px-4 pt-6">
          <p className="text-center text-sm text-muted-foreground">
            Enter your 4-digit PIN to authorize this payment. Demo PIN: {DEMO_PIN}
          </p>
          <div className="mt-8">
            <PinPad value={pin} onChange={setPin} />
          </div>
          <Button
            className="mt-8 h-13 w-full rounded-2xl text-base font-bold"
            disabled={pin.length < 4}
            onClick={() => {
              if (pin !== DEMO_PIN) {
                setPin("");
                toast.error("Incorrect PIN. Try 1234 for this demo.");
                return;
              }
              void runPayment();
            }}
          >
            Confirm
          </Button>
        </div>
      </AppShell>
    );
  }

  /* ---------- CONFIRM ---------- */
  if (step === "confirm") {
    const insufficient = total > balance;
    return (
      <AppShell>
        <PageHeader
          title="Confirm Payment"
          onBack={() => setStep(service.mode === "package" ? "amount" : "amount")}
        />
        <div className="space-y-5 px-4 pt-2 pb-6">
          <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-5 shadow-card">
            <span className={cn("grid size-12 place-items-center rounded-2xl", service.tint)}>
              <service.icon className="size-6" />
            </span>
            <p className="text-sm font-bold">
              {provider} {service.name}
            </p>
            <p className="text-3xl font-extrabold tabular-nums">{formatNaira(total, false)}</p>
          </div>

          <div className="divide-y rounded-2xl border bg-card px-4 py-2 shadow-card">
            {service.customerName ? <InfoRow label="Customer" value={service.customerName} /> : null}
            <InfoRow label={service.identifierLabel} value={maskTail(identifier)} />
            {pack ? <InfoRow label="Package" value={`${pack.name} • ${formatNaira(pack.price, false)}`} /> : null}
            <InfoRow label="Amount" value={formatNaira(total)} />
            <InfoRow label="Payment Method" value="Wallet Balance" />
            <InfoRow label="Current Balance" value={formatNaira(balance)} />
            <InfoRow label="Balance After" value={formatNaira(Math.max(balance - total, 0))} />
          </div>

          {insufficient ? (
            <div className="flex items-start gap-3 rounded-2xl bg-destructive-soft p-3 text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p className="text-xs font-semibold">
                Insufficient balance. Fund your wallet to complete this payment.
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-dashed p-3">
            <p className="mb-2 text-[11px] font-bold text-muted-foreground">
              DEMO ONLY — simulate the outcome
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["successful", "pending", "failed"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  className={cn(
                    "press h-9 rounded-lg border text-xs font-bold capitalize",
                    outcome === o ? "border-primary bg-primary-soft text-primary" : "bg-card",
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {insufficient ? (
            <Button className="h-13 w-full rounded-2xl text-base font-bold" asChild>
              <Link to="/wallet/fund" search={{ amount: undefined }}>Fund Wallet</Link>
            </Button>
          ) : (
            <Button
              className="h-13 w-full rounded-2xl text-base font-bold"
              onClick={() => {
                setPin("");
                setStep("pin");
              }}
            >
              Pay {formatNaira(total, false)}
            </Button>
          )}
        </div>
      </AppShell>
    );
  }

  /* ---------- AMOUNT / PACKAGE ---------- */
  if (step === "amount") {
    return (
      <AppShell>
        <PageHeader
          title={service.mode === "package" ? "Select Package" : "Enter Amount"}
          subtitle={`${provider} • ${service.name}`}
          onBack={() => setStep(service.verifies ? "verify" : "identifier")}
        />
        <div className="space-y-5 px-4 pt-2 pb-6">
          {service.mode === "package" ? (
            <div className="space-y-3">
              {service.packages?.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPack(p)}
                  className={cn(
                    "press flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left shadow-card",
                    pack?.id === p.id ? "border-primary bg-primary-soft" : "",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{p.name}</span>
                    {p.note ? (
                      <span className="block text-xs text-muted-foreground">{p.note}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm font-extrabold">{formatNaira(p.price, false)}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-2xl border bg-card p-5 text-center shadow-card">
                <Label htmlFor="amount" className="text-xs text-muted-foreground">
                  Amount to pay
                </Label>
                <div className="mt-2 flex items-center justify-center gap-1">
                  <span className="text-2xl font-extrabold">₦</span>
                  <Input
                    id="amount"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                    className="h-14 border-0 bg-transparent text-center text-3xl font-extrabold shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {service.quickAmounts?.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    className={cn(
                      "press h-11 rounded-xl border bg-card text-xs font-bold",
                      amount === String(q) ? "border-primary bg-primary-soft text-primary" : "",
                    )}
                  >
                    {formatNaira(q, false)}
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Min: ₦100 • Max: ₦50,000 per transaction
              </p>
            </>
          )}

          <Button
            className="h-13 w-full rounded-2xl text-base font-bold"
            disabled={total < 100}
            onClick={() => setStep("confirm")}
          >
            Continue
          </Button>
        </div>
      </AppShell>
    );
  }

  /* ---------- VERIFY ---------- */
  if (step === "verify") {
    return (
      <AppShell>
        <PageHeader title="Verify Customer" onBack={() => setStep("identifier")} />
        <div className="space-y-5 px-4 pt-2 pb-6">
          {verifying ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 py-6 text-sm font-semibold text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Verifying {service.identifierLabel.toLowerCase()}…
              </div>
              <RowSkeleton />
              <RowSkeleton />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-2xl bg-success-soft p-3 text-success">
                <CheckCircle2 className="size-5" />
                <p className="text-sm font-bold">Customer Found</p>
              </div>
              <div className="divide-y rounded-2xl border bg-card px-4 py-2 shadow-card">
                <InfoRow label="Customer Name" value={service.customerName ?? "John Doe"} />
                {service.address ? <InfoRow label="Address" value={service.address} /> : null}
                <InfoRow label={service.identifierLabel} value={identifier} />
                <InfoRow label="Provider" value={provider} />
              </div>
              <Button
                className="h-13 w-full rounded-2xl text-base font-bold"
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

  /* ---------- IDENTIFIER ---------- */
  if (step === "identifier") {
    return (
      <AppShell>
        <PageHeader title={service.name} subtitle={provider} onBack={() => setStep("provider")} />
        <div className="space-y-5 px-4 pt-2 pb-6">
          <div className="space-y-2">
            <Label htmlFor="identifier">{service.identifierLabel}</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={service.identifierPlaceholder}
              inputMode={service.numeric ? "numeric" : "text"}
              className="h-13 rounded-xl bg-card"
              aria-invalid={Boolean(error)}
            />
            {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
          </div>

          {service.identifierHelp ? (
            <div className="flex items-start gap-3 rounded-2xl bg-primary-soft p-3">
              <HelpCircle className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-bold">
                  How to find your {service.identifierLabel.toLowerCase()}
                </p>
                <p className="text-xs text-muted-foreground">{service.identifierHelp}</p>
              </div>
            </div>
          ) : null}

          <Button className="h-13 w-full rounded-2xl text-base font-bold" onClick={startVerify}>
            Continue
          </Button>
        </div>
      </AppShell>
    );
  }

  /* ---------- PROVIDER ---------- */
  return (
    <AppShell>
      <PageHeader title={`Pay ${service.name}`} backTo="/services" />
      <div className="space-y-5 px-4 pt-2 pb-6">
        <div>
          <p className="text-sm font-bold">{service.providerLabel}</p>
          <p className="text-xs text-muted-foreground">Choose from the providers below</p>
        </div>
        <div className="space-y-2">
          {service.providers.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setProvider(p);
                setStep("identifier");
              }}
              className={cn(
                "press flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-card",
                provider === p ? "border-primary" : "",
              )}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", service.tint)}>
                <service.icon className="size-5" />
              </span>
              <span className="flex-1 text-sm font-bold">{p}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
