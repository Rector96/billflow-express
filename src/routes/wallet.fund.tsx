import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Home,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError, useApp } from "@/lib/app-store";
import { formatNaira } from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { initializeWalletFunding, verifyWalletFunding } from "@/lib/paystack.functions";

export const Route = createFileRoute("/wallet/fund")({
  head: () => ({
    meta: [
      { title: `Fund wallet — ${BRAND.name}` },
      {
        name: "description",
        content: "Add money to your wallet and pay bills instantly.",
      },
      { property: "og:title", content: `Fund wallet — ${BRAND.name}` },
      {
        property: "og:description",
        content: "Top up in seconds and pay your bills.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { amount?: number; reference?: string } => {
    const ref =
      typeof search["reference"] === "string"
        ? search["reference"]
        : typeof search["trxref"] === "string"
          ? search["trxref"]
          : undefined;

    return {
      ...(typeof search["amount"] === "number" ? { amount: search["amount"] } : {}),
      ...(ref ? { reference: ref } : {}),
    };
  },
  component: FundWallet,
});

const QUICK = [1000, 5000, 10000, 20000];

type Stage = "form" | "redirecting" | "confirming" | "successful" | "pending" | "failed";

function FundWallet() {
  const navigate = useNavigate();
  const { balance, refresh, profile } = useApp();
  const { amount: preset, reference } = Route.useSearch();

  const initFunding = useServerFn(initializeWalletFunding);
  const verifyFunding = useServerFn(verifyWalletFunding);

  const [amount, setAmount] = useState<number>(preset && QUICK.includes(preset) ? preset : 5000);
  const [custom, setCustom] = useState("");
  const [stage, setStage] = useState<Stage>(reference ? "confirming" : "form");
  const [settled, setSettled] = useState<{
    reference: string;
    amount: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const verified = useRef<string | null>(null);
  const starting = useRef(false);

  const value = custom ? Number(custom.replace(/\D/g, "")) : amount;

  const confirm = useCallback(
    async (ref: string) => {
      setStage("confirming");

      try {
        const result = await verifyFunding({
          data: { reference: ref },
        });

        setSettled({
          reference: result.reference,
          amount: result.amount,
        });

        setStage(result.status);
        await refresh();
      } catch (err) {
        setStage("pending");
        setSettled({ reference: ref, amount: 0 });

        toast.error(friendlyError(err, "We couldn't confirm this payment yet."));
      }
    },
    [verifyFunding, refresh],
  );

  useEffect(() => {
    if (!reference || verified.current === reference) return;

    verified.current = reference;
    void confirm(reference);
  }, [reference, confirm]);

  const start = async () => {
    if (starting.current || busy) return;

    if (!value || value < 100) {
      toast.error("Enter at least ₦100");
      return;
    }
    starting.current = true;
    setBusy(true);
    setStage("redirecting");

    try {
      const result = await initFunding({
        data: { amount: value },
      });

      if (result.status === "pending") {
        setSettled({
          reference: result.reference,
          amount: result.amount,
        });

        setStage("pending");
        toast.error(result.message);
        await refresh();
        return;
      }

      window.location.href = result.authorizationUrl;
    } catch (err) {
      toast.error(friendlyError(err, "Could not start funding."));
      setStage("form");
    } finally {
      starting.current = false;
      setBusy(false);
      setStage("form");
    }
  };

  const copyRef = async () => {
    if (!settled?.reference) return;

    try {
      await navigator.clipboard.writeText(settled.reference);
      toast.success("Reference copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  // Payment redirection and verification screen
  if (stage === "redirecting" || stage === "confirming") {
    return (
      <AppShell>
        <main className="flex min-h-[75dvh] items-center justify-center px-4 py-10 sm:px-6">
          <section className="w-full max-w-md rounded-3xl border border-border/70 bg-card px-6 py-10 text-center shadow-xl shadow-black/[0.03] sm:px-9">
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
              <Loader2 className="size-10 animate-spin" />
            </div>

            <h1 className="mt-7 text-xl font-extrabold tracking-tight sm:text-2xl">
              {stage === "redirecting" ? "Opening secure checkout" : "Confirming your payment"}
            </h1>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              {stage === "redirecting"
                ? `Taking you to Paystack to pay ${formatNaira(value, false)}. Do not close this page.`
                : "We are verifying this payment with Paystack on our servers. Your wallet is only credited after verification succeeds."}
            </p>

            <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-secondary/70 px-4 py-2 text-xs font-semibold text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              Secure payment verification
            </div>
          </section>
        </main>
      </AppShell>
    );
  }

  // Payment result screen
  if (stage === "successful" || stage === "pending" || stage === "failed") {
    const meta = {
      successful: {
        icon: CheckCircle2,
        tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        ring: "ring-emerald-500/10",
        title: "Payment successful!",
        body: "Your wallet has been credited successfully. Your funds are ready to use.",
        label: "PAYMENT CONFIRMED",
        status: "Successful",
        accent: "text-emerald-600 dark:text-emerald-400",
      },
      pending: {
        icon: Clock,
        tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        ring: "ring-amber-500/10",
        title: "Payment processing",
        body: "We are still waiting for Paystack to confirm your payment. Your wallet will only be credited after successful verification.",
        label: "AWAITING CONFIRMATION",
        status: "Pending",
        accent: "text-amber-600 dark:text-amber-400",
      },
      failed: {
        icon: AlertTriangle,
        tone: "bg-red-500/10 text-red-600 dark:text-red-400",
        ring: "ring-red-500/10",
        title: "Payment unsuccessful",
        body: "This payment could not be completed. Your wallet has not been credited.",
        label: "PAYMENT NOT COMPLETED",
        status: "Failed",
        accent: "text-red-600 dark:text-red-400",
      },
    }[stage];

    return (
      <AppShell>
        <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-6 sm:py-9 lg:px-8 lg:py-12">
          <div className="mx-auto mb-6 max-w-3xl text-center lg:mb-8">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground shadow-sm">
              <ShieldCheck className="size-3.5 text-primary" />
              RockPay secure transaction
            </div>
            <p className="text-xs text-muted-foreground">Wallet funding confirmation</p>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[1.08fr_0.92fr] lg:gap-6">
            {/* Main confirmation card */}
            <section className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-lg shadow-black/[0.04]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
              <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/[0.07] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-20 size-64 rounded-full bg-emerald-500/[0.06] blur-3xl" />

              <div className="relative flex flex-col items-center px-5 py-9 text-center sm:px-9 sm:py-12 lg:min-h-[540px] lg:justify-center">
                <div
                  className={cn(
                    "mb-5 grid size-20 place-items-center rounded-full ring-8 ring-offset-4 ring-offset-card sm:size-24",
                    meta.tone,
                    meta.ring,
                  )}
                >
                  <meta.icon
                    className={cn(
                      "size-10 sm:size-12",
                      stage === "successful" && "animate-in zoom-in duration-500",
                    )}
                    strokeWidth={1.7}
                  />
                </div>

                <span
                  className={cn(
                    "mb-3 rounded-full px-3 py-1.5 text-[10px] font-extrabold tracking-[0.15em]",
                    meta.tone,
                  )}
                >
                  {meta.label}
                </span>

                <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                  {meta.title}
                </h1>

                <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
                  {meta.body}
                </p>

                <div className="mt-8 w-full max-w-sm rounded-2xl border border-border/60 bg-secondary/40 px-4 py-6 sm:px-6 sm:py-7">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {stage === "successful" ? "Amount added to your wallet" : "Transaction amount"}
                  </p>

                  <p className="mt-3 break-words text-3xl font-black tracking-tight text-foreground tabular-nums sm:text-4xl">
                    {formatNaira(settled?.amount ?? 0)}
                  </p>

                  {stage === "successful" && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      Successfully credited
                    </div>
                  )}
                </div>

                <div className="mt-7 w-full max-w-sm space-y-3">
                  {stage === "successful" ? (
                    <>
                      <Button
                        className="h-12 w-full rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
                        onClick={() => navigate({ to: "/wallet" })}
                      >
                        <Wallet className="mr-2 size-4" />
                        View my wallet
                        <ArrowRight className="ml-auto size-4" />
                      </Button>

                      <Button
                        variant="outline"
                        className="h-12 w-full rounded-xl text-sm font-semibold"
                        onClick={() => navigate({ to: "/home" })}
                      >
                        <Home className="mr-2 size-4" />
                        Back to home
                      </Button>
                    </>
                  ) : stage === "pending" ? (
                    <>
                      <Button
                        className="h-12 w-full rounded-xl font-bold"
                        onClick={() => settled?.reference && void confirm(settled.reference)}
                      >
                        <RefreshCw className="mr-2 size-4" />
                        Check payment status
                      </Button>

                      <Button
                        variant="outline"
                        className="h-12 w-full rounded-xl font-semibold"
                        onClick={() => navigate({ to: "/wallet" })}
                      >
                        Back to wallet
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        className="h-12 w-full rounded-xl font-bold"
                        onClick={() => {
                          verified.current = null;
                          setSettled(null);
                          navigate({
                            to: "/wallet/fund",
                            search: {},
                          });
                          setStage("form");
                        }}
                      >
                        <RefreshCw className="mr-2 size-4" />
                        Try again
                      </Button>

                      <Button
                        variant="outline"
                        className="h-12 w-full rounded-xl font-semibold"
                        onClick={() => navigate({ to: "/home" })}
                      >
                        <Home className="mr-2 size-4" />
                        Back to home
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* Transaction receipt */}
            <section className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-lg shadow-black/[0.04]">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-base font-extrabold tracking-tight text-foreground">
                    Transaction receipt
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">Your wallet funding details</p>
                </div>

                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Wallet className="size-5" />
                </span>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <div className="rounded-2xl bg-secondary/40 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Transaction summary
                  </p>

                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">Description</span>
                      <span className="text-right text-sm font-bold text-foreground">
                        Wallet top-up
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">Payment method</span>
                      <span className="text-sm font-bold text-foreground">Paystack</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">Payment status</span>
                      <span className={cn("text-sm font-extrabold", meta.accent)}>
                        {meta.status}
                      </span>
                    </div>

                    {profile.email && (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Account</span>
                        <span className="max-w-[65%] break-all text-right text-sm font-semibold text-foreground">
                          {profile.email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {settled?.reference && (
                  <div className="rounded-2xl border border-dashed border-border bg-background p-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                      Transaction reference
                    </p>

                    <div className="mt-3 flex min-w-0 items-center gap-2">
                      <p className="min-w-0 flex-1 break-all font-mono text-xs font-bold leading-5 text-foreground sm:text-sm">
                        {settled.reference}
                      </p>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0 rounded-lg bg-card px-3"
                        onClick={() => void copyRef()}
                      >
                        <Copy className="mr-1.5 size-3.5" />
                        Copy
                      </Button>
                    </div>
                  </div>
                )}

                {settled?.reference && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-xl font-semibold"
                    onClick={() =>
                      navigate({
                        to: "/history/$txId",
                        params: { txId: settled.reference },
                      })
                    }
                  >
                    View full transaction receipt
                    <ArrowRight className="ml-auto size-4" />
                  </Button>
                )}

                <div className="flex items-start gap-3 rounded-2xl border border-primary/10 bg-primary/[0.045] p-4">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Your payment is processed securely through Paystack. RockPay verifies every
                    transaction on its servers before crediting your wallet.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            <span>{BRAND.name} · Secure payments, simpler everyday transactions.</span>
          </div>
        </main>
      </AppShell>
    );
  }

  // Wallet funding form
  return (
    <AppShell>
      <PageHeader
        title="Fund Wallet"
        subtitle={`Balance ${formatNaira(balance)}`}
        backTo="/wallet"
      />

      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pt-3 pb-8 sm:px-6">
        <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </span>

            <div>
              <h2 className="text-base font-bold">Add money to your wallet</h2>
              <p className="mt-1 text-xs text-muted-foreground">Choose an amount to get started.</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-bold">Select an amount</p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setAmount(q);
                    setCustom("");
                  }}
                  className={cn(
                    "press h-12 rounded-xl border bg-background text-sm font-bold transition-all disabled:opacity-60",
                    !custom && amount === q
                      ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-secondary/50",
                  )}
                >
                  {formatNaira(q, false)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Label htmlFor="custom">Custom amount</Label>

            <Input
              id="custom"
              inputMode="numeric"
              value={custom}
              disabled={busy}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter amount"
              className="h-14 rounded-xl bg-background text-lg font-bold"
            />

            <p className="text-xs text-muted-foreground">Minimum wallet funding amount: ₦100</p>
          </div>

          <div className="mt-6 rounded-2xl border border-border/70 bg-secondary/40 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">You are adding</span>
              <span className="font-bold tabular-nums">{formatNaira(value || 0)}</span>
            </div>

            <div className="mt-3 flex justify-between gap-3">
              <span className="text-muted-foreground">New balance after success</span>
              <span className="font-bold tabular-nums">{formatNaira(balance + (value || 0))}</span>
            </div>

            <div className="mt-3 flex justify-between gap-3">
              <span className="text-muted-foreground">Payment method</span>
              <span className="font-bold">Paystack</span>
            </div>
          </div>

          <Button
            onClick={() => void start()}
            disabled={busy || !value || value < 100}
            className="mt-6 h-13 w-full rounded-xl text-base font-bold shadow-md shadow-primary/15"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Starting checkout…
              </>
            ) : (
              <>
                Continue · {formatNaira(value || 0, false)}
                <ArrowRight className="ml-2 size-4" />
              </>
            )}
          </Button>

          <div className="mt-5 flex items-start justify-center gap-2 text-center">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            <p className="text-[11px] leading-5 text-muted-foreground">
              Secured by Paystack. Your wallet is credited only after server-side payment
              verification.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
