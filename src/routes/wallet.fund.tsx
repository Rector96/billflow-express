import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
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
  validateSearch: (search: Record<string, unknown>) => ({
    amount: typeof search['amount'] === "number" ? (search['amount'] as number) : undefined,
    reference: typeof search['reference'] === "string" ? (search['reference'] as string) : undefined,
  }),
  component: FundWallet,
});

const QUICK = [1000, 5000, 10000, 20000];

type Stage = "form" | "redirecting" | "confirming" | "successful" | "pending" | "failed";

function FundWallet() {
  const navigate = useNavigate();
  const { balance, refresh } = useApp();
  const { amount: preset, reference } = Route.useSearch();
  const initFunding = useServerFn(initializeWalletFunding);
  const verifyFunding = useServerFn(verifyWalletFunding);

  const [amount, setAmount] = useState<number>(preset && QUICK.includes(preset) ? preset : 5000);
  const [custom, setCustom] = useState("");
  const [stage, setStage] = useState<Stage>(reference ? "confirming" : "form");
  const [settled, setSettled] = useState<{ reference: string; amount: number } | null>(null);
  const verified = useRef<string | null>(null);

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
    if (!value || value < 100) {
      toast.error("Enter at least ₦100");
      return;
    }
    setStage("redirecting");
    try {
      const { authorizationUrl } = await initFunding({ data: { amount: value } });
      window.location.href = authorizationUrl;
    } catch (err) {
      setStage("form");
      toast.error(friendlyError(err, "We couldn't start your top-up."));
    }
  };

  if (stage === "redirecting" || stage === "confirming") {
    return (
      <AppShell>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
          <Loader2 className="size-12 animate-spin text-primary" />
          <h1 className="text-xl font-extrabold">
            {stage === "redirecting" ? "Opening secure checkout" : "Payment is being confirmed"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {stage === "redirecting"
              ? `Taking you to Paystack to pay ${formatNaira(value, false)}.`
              : "We're checking this payment with Paystack. Please don't close this page."}
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
        title: "Wallet Funded",
        body: `${formatNaira(settled?.amount ?? 0, false)} was added to your wallet.`,
      },
      pending: {
        icon: Clock,
        tone: "bg-warning-soft text-warning",
        title: "Payment pending",
        body: "Payment is being confirmed. Your wallet will be credited once Paystack confirms it.",
      },
      failed: {
        icon: AlertTriangle,
        tone: "bg-destructive-soft text-destructive",
        title: "Payment failed",
        body: "This payment did not go through, so your balance is unchanged.",
      },
    }[stage];

    return (
      <AppShell>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
          <span className={cn("animate-in zoom-in grid size-20 place-items-center rounded-full", meta.tone)}>
            <meta.icon className="size-10" />
          </span>
          <h1 className="text-2xl font-extrabold">{meta.title}</h1>
          <p className="text-sm text-muted-foreground">
            {meta.body}
            {settled?.reference ? ` Reference ${settled.reference}.` : ""}
          </p>
          <div className="mt-4 w-full max-w-sm space-y-3">
            <Button className="h-13 w-full rounded-2xl font-bold" onClick={() => navigate({ to: "/wallet" })}>
              Back to Wallet
            </Button>
            {stage === "successful" ? (
              <Button
                variant="outline"
                className="h-13 w-full rounded-2xl font-bold"
                onClick={() => navigate({ to: "/services" })}
              >
                Pay a bill
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-13 w-full rounded-2xl font-bold"
                onClick={() => navigate({ to: "/wallet/fund", search: { amount: undefined, reference: undefined } })}
              >
                Try again
              </Button>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Fund Wallet" subtitle={`Balance ${formatNaira(balance)}`} backTo="/wallet" />
      <div className="space-y-6 px-4 pt-2 pb-6">
        <div>
          <p className="mb-3 text-sm font-bold">Select or enter amount</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setAmount(q);
                  setCustom("");
                }}
                className={cn(
                  "press h-12 rounded-xl border bg-card text-sm font-bold",
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
            <span className="text-muted-foreground">New balance</span>
            <span className="font-bold">{formatNaira(balance + (value || 0))}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-muted-foreground">Payment method</span>
            <span className="font-bold">Paystack</span>
          </div>
        </div>

        <Button onClick={() => void start()} className="h-13 w-full rounded-2xl text-base font-bold">
          Continue
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Secured by Paystack (test mode). Your wallet is credited only after the payment is verified.
        </p>
      </div>
    </AppShell>
  );
}
