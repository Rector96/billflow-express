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
import { isSupabaseConfigured } from "@/integrations/supabase/client";

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
    // Paystack may return reference or trxref on callback
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
        // Never show successful unless server verified + settled
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

    if (!isSupabaseConfigured()) {
      starting.current = true;
      setBusy(true);
      setStage("redirecting");
      setTimeout(async () => {
        const fakeRef = `RP-TOPUP-${Date.now().toString(36).toUpperCase()}`;
        setSettled({ reference: fakeRef, amount: value });
        setStage("successful");
        setBusy(false);
        starting.current = false;
        try {
          const store = JSON.parse(localStorage.getItem("rockpay_preview_store_v1") || "{}");
          if (store.wallet) {
            store.wallet.balance = (store.wallet.balance || 0) + value;
            store.transactions = store.transactions || [];
            store.transactions.unshift({
              id: `tx-${Date.now()}`,
              reference: fakeRef,
              type: "deposit",
              amount: value,
              status: "successful",
              description: "Wallet Top-up (Preview)",
              metadata: {
                title: "Wallet Top-up",
                channel: "paystack",
                service_slug: "wallet",
              },
              created_at: new Date().toISOString(),
            });
            localStorage.setItem("rockpay_preview_store_v1", JSON.stringify(store));
          }
          await refresh();
          toast.success(`Successfully added ${formatNaira(value)} to your wallet!`);
        } catch {
          // ignore
        }
      }, 1000);
      return;
    }

    starting.current = true;
    setBusy(true);
    setStage("redirecting");
    try {
      const { authorizationUrl } = await initFunding({ data: { amount: value } });
      window.location.href = authorizationUrl;
    } catch (err) {
      starting.current = false;
      setBusy(false);
      setStage("form");
      toast.error(friendlyError(err, "We couldn't start your top-up."));
    }
  };

  const copyRef = async () => {
    if (!settled?.reference) return;
    try {
      await navigator.clipboard.writeText(settled.reference);
      toast.success("Reference copied");
    } catch {
      toast.error("Could not copy reference");
    }
  };

  if (stage === "redirecting" || stage === "confirming") {
    return (
      <AppShell>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
          <Loader2 className="size-12 animate-spin text-primary" />
          <h1 className="text-xl font-extrabold">
            {stage === "redirecting" ? "Opening secure checkout" : "Confirming your payment"}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {stage === "redirecting"
              ? `Taking you to Paystack to pay ${formatNaira(value, false)}. Do not close this page.`
              : "We are verifying this payment with Paystack on our servers. Your wallet is only credited after verification succeeds."}
          </p>
        </div>
      </AppShell>
    );
  }

  if (stage === "successful" || stage === "pending" || stage === "failed") {
    const meta = {
      successful: {
        icon: CheckCircle2,
        tone: "bg-success-soft text-success",
        title: "Payment successful",
        body: "Your wallet has been credited. You can pay bills immediately.",
      },
      pending: {
        icon: Clock,
        tone: "bg-warning-soft text-warning",
        title: "Payment pending",
        body: "Paystack has not confirmed this payment yet. Your balance is unchanged until verification succeeds.",
      },
      failed: {
        icon: AlertTriangle,
        tone: "bg-destructive-soft text-destructive",
        title: "Payment failed",
        body: "This payment did not go through (failed, cancelled, or abandoned). Your wallet was not charged.",
      },
    }[stage];

    return (
      <AppShell>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 py-8 text-center sm:px-6">
          <span
            className={cn(
              "animate-in zoom-in grid size-20 place-items-center rounded-full",
              meta.tone,
            )}
          >
            <meta.icon className="size-10" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">{meta.title}</h1>
          <p className="max-w-md text-sm text-muted-foreground">{meta.body}</p>

          <div className="mt-2 w-full max-w-sm rounded-2xl border bg-card p-4 text-left text-sm shadow-card">
            <div className="flex justify-between gap-3 py-1.5">
              <span className="text-muted-foreground">What you paid for</span>
              <span className="font-bold">Wallet top-up</span>
            </div>
            <div className="flex justify-between gap-3 py-1.5">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-bold">{formatNaira(settled?.amount ?? 0)}</span>
            </div>
            <div className="flex justify-between gap-3 py-1.5">
              <span className="text-muted-foreground">Payment method</span>
              <span className="font-bold">Paystack</span>
            </div>
            {profile.email ? (
              <div className="flex justify-between gap-3 py-1.5">
                <span className="text-muted-foreground">Account</span>
                <span className="max-w-[60%] truncate font-semibold">{profile.email}</span>
              </div>
            ) : null}
            {settled?.reference ? (
              <div className="mt-2 flex items-center justify-between gap-2 border-t pt-3">
                <div className="min-w-0 text-left">
                  <p className="text-[11px] text-muted-foreground">Transaction reference</p>
                  <p className="truncate font-mono text-xs font-bold">{settled.reference}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-xl"
                  onClick={() => void copyRef()}
                >
                  <Copy className="size-3.5" />
                  Copy
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 w-full max-w-sm space-y-3">
            {stage === "successful" ? (
              <>
                <Button
                  className="h-13 w-full rounded-2xl font-bold"
                  onClick={() => navigate({ to: "/home" })}
                >
                  <Home className="mr-2 size-4" />
                  Go to Home
                </Button>
                <Button
                  variant="outline"
                  className="h-13 w-full rounded-2xl font-bold"
                  onClick={() => navigate({ to: "/wallet" })}
                >
                  <Wallet className="mr-2 size-4" />
                  View wallet
                </Button>
              </>
            ) : stage === "pending" ? (
              <>
                <Button
                  className="h-13 w-full rounded-2xl font-bold"
                  onClick={() => settled?.reference && void confirm(settled.reference)}
                >
                  <RefreshCw className="mr-2 size-4" />
                  Refresh status
                </Button>
                <Button
                  variant="outline"
                  className="h-13 w-full rounded-2xl font-bold"
                  onClick={() => navigate({ to: "/wallet" })}
                >
                  Back to Wallet
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="h-13 w-full rounded-2xl font-bold"
                  onClick={() => {
                    verified.current = null;
                    setSettled(null);
                    navigate({ to: "/wallet/fund", search: {} });
                    setStage("form");
                  }}
                >
                  Try again
                </Button>
                <Button
                  variant="outline"
                  className="h-13 w-full rounded-2xl font-bold"
                  onClick={() => navigate({ to: "/home" })}
                >
                  Go to Home
                </Button>
              </>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Fund Wallet"
        subtitle={`Balance ${formatNaira(balance)}`}
        backTo="/wallet"
      />
      <div className="space-y-6 px-4 pt-2 pb-6">
        <div>
          <p className="mb-3 text-sm font-bold">Select or enter amount</p>
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
