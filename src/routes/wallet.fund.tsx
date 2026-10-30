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
  Wallet,
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
      { name: "description", content: "Add money to your wallet and pay bills instantly." },
      { property: "og:title", content: `Fund wallet — ${BRAND.name}` },
      { property: "og:description", content: "Top up in seconds and pay your bills." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { amount?: number; reference?: string } => {
    const ref =
      typeof search["reference"] === "string"
        ? (search["reference"] as string)
        : typeof search["trxref"] === "string"
          ? (search["trxref"] as string)
          : undefined;
    return {
      ...(typeof search["amount"] === "number" ? { amount: search["amount"] as number } : {}),
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
  const [settled, setSettled] = useState<{ reference: string; amount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const verified = useRef<string | null>(null);
  const starting = useRef(false);

  const value = custom ? Number(custom.replace(/\D/g, "")) : amount;

  const confirm = useCallback(
    async (ref: string) => {
      setStage("confirming");
      try {
        const result = await verifyFunding({ data: { reference: ref } });
        setSettled({ reference: result.reference, amount: result.amount });
        setStage(result.status);
        await refresh();
      } catch (err) {
        setStage("pending");
        toast.error(friendlyError(err, "Could not confirm funding yet."));
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
      const res = await initFunding({
        data: {
          amount: value,
          email: profile.email || undefined,
        },
      });
      if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
        return;
      }
      toast.error("Could not start checkout");
      setStage("form");
    } catch (err) {
      toast.error(friendlyError(err, "Could not start funding."));
      setStage("form");
    } finally {
      starting.current = false;
      setBusy(false);
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

  if (stage === "redirecting" || stage === "confirming") {
    return (
      <AppShell>
        <PageHeader title="Fund wallet" backTo="/wallet" />
        <div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-8 text-center sm:px-6 lg:max-w-lg lg:px-0 lg:py-12">
          <span className="grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
            <Loader2 className="size-8 animate-spin" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {stage === "redirecting" ? "Opening Paystack…" : "Confirming payment…"}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {stage === "redirecting"
              ? "You will be redirected to complete card payment."
              : "Please wait while we verify your payment."}
          </p>
        </div>
      </AppShell>
    );
  }

  if (stage === "successful" || stage === "pending" || stage === "failed") {
    const meta =
      stage === "successful"
        ? {
            icon: CheckCircle2,
            tone: "bg-success-soft text-success",
            title: "Wallet funded",
          }
        : stage === "failed"
          ? {
              icon: AlertTriangle,
              tone: "bg-destructive-soft text-destructive",
              title: "Funding failed",
            }
          : {
              icon: Clock,
              tone: "bg-warning-soft text-warning",
              title: "Payment pending",
            };
    const Icon = meta.icon;
    return (
      <AppShell>
        <PageHeader title="Fund wallet" backTo="/wallet" />
        <div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-8 text-center sm:px-6 lg:max-w-lg lg:px-0 lg:py-12">
          <span className={cn("grid size-16 place-items-center rounded-full", meta.tone)}>
            <Icon className="size-8" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">{meta.title}</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {stage === "successful"
              ? "Your wallet balance has been updated."
              : stage === "failed"
                ? "The payment did not complete. You can try again."
                : "We are still confirming this payment. Refresh in a moment."}
          </p>

          <div className="mt-2 w-full max-w-sm rounded-2xl border bg-card p-4 text-left text-sm shadow-card lg:max-w-md">
            <div className="flex justify-between gap-3 py-1.5">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-bold">{formatNaira(settled?.amount ?? value ?? 0)}</span>
            </div>
            {settled?.reference ? (
              <div className="flex justify-between gap-3 py-1.5">
                <span className="text-muted-foreground">Reference</span>
                <button
                  type="button"
                  className="max-w-[60%] truncate font-mono text-xs font-bold text-primary"
                  onClick={() => void copyRef()}
                >
                  {settled.reference}
                </button>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 py-1.5">
              <span className="text-muted-foreground">Balance</span>
              <span className="font-bold">{formatNaira(balance)}</span>
            </div>
          </div>

          <div className="mt-2 w-full max-w-sm space-y-3 lg:max-w-md">
            {stage === "pending" ? (
              <Button
                className="h-13 w-full rounded-2xl font-bold"
                onClick={() => reference && void confirm(reference)}
              >
                <RefreshCw className="mr-2 size-4" /> Refresh status
              </Button>
            ) : null}
            <Button
              className="h-13 w-full rounded-2xl font-bold"
              onClick={() => navigate({ to: "/wallet" })}
            >
              <Wallet className="mr-2 size-4" /> Back to Wallet
            </Button>
            <Button
              variant="outline"
              className="h-13 w-full rounded-2xl font-bold"
              onClick={() => navigate({ to: "/home" })}
            >
              <Home className="mr-2 size-4" /> Go to Home
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Fund wallet" backTo="/wallet" />
      <div className="mx-auto w-full max-w-md space-y-6 px-4 pt-2 pb-8 lg:max-w-xl lg:px-0">
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="text-xs font-medium text-muted-foreground">Current balance</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{formatNaira(balance)}</p>
        </div>

        <div className="space-y-2">
          <Label>Quick amounts</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                  "press h-12 rounded-xl border bg-card text-sm font-bold disabled:opacity-60",
                  !custom && amount === q ? "border-primary bg-primary-soft text-primary" : "",
                )}
              >
                {formatNaira(q, false)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom">Custom amount</Label>
          <Input
            id="custom"
            inputMode="numeric"
            value={custom}
            disabled={busy}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
            placeholder="0.00"
            className="h-14 rounded-xl bg-card text-lg font-bold"
          />
        </div>

        <div className="rounded-2xl border bg-card p-4 text-sm shadow-card">
          <div className="flex justify-between">
            <span className="text-muted-foreground">You are adding</span>
            <span className="font-bold">{formatNaira(value || 0)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-muted-foreground">New balance (after success)</span>
            <span className="font-bold">{formatNaira(balance + (value || 0))}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-muted-foreground">Payment method</span>
            <span className="font-bold">Paystack (card)</span>
          </div>
        </div>

        <Button
          onClick={() => void start()}
          disabled={busy || !value || value < 100}
          className="h-13 w-full rounded-2xl text-base font-bold"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Starting checkout…
            </>
          ) : (
            `Continue · ${formatNaira(value || 0, false)}`
          )}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Secured by Paystack. Your wallet is credited only after server-side verification — never
          from the browser alone.
        </p>
      </div>
    </AppShell>
  );
}
