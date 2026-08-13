import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp, useNewTxId } from "@/lib/app-store";
import { formatNaira } from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wallet/fund")({
  head: () => ({
    meta: [
      { title: `Fund wallet — ${BRAND.name}` },
      { name: "description", content: "Add money to your wallet and pay bills instantly." },
      { property: "og:title", content: `Fund wallet — ${BRAND.name}` },
      { property: "og:description", content: "Top up in seconds with a simulated payment." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    amount: typeof search.amount === "number" ? search.amount : undefined,
  }),
  component: FundWallet,
});

const QUICK = [1000, 5000, 10000, 20000];

function FundWallet() {
  const navigate = useNavigate();
  const { addTransaction, pushNotification, balance } = useApp();
  const newId = useNewTxId();
  const preset = Route.useSearch().amount;
  const [amount, setAmount] = useState<number>(preset && QUICK.includes(preset) ? preset : 5000);
  const [custom, setCustom] = useState("");
  const [stage, setStage] = useState<"form" | "processing" | "done">("form");
  const [txId, setTxId] = useState("");

  const value = custom ? Number(custom.replace(/\D/g, "")) : amount;

  const start = () => {
    if (!value || value < 100) {
      toast.error("Enter at least ₦100");
      return;
    }
    const id = newId();
    setTxId(id);
    setStage("processing");
    setTimeout(() => {
      addTransaction({
        id,
        title: "Wallet Funded",
        service: "Card Top-up (Demo)",
        serviceSlug: "wallet",
        amount: value,
        direction: "in",
        status: "successful",
        date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        time: new Date().toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }),
        method: "Card",
      });
      pushNotification({
        id,
        type: "success",
        title: `Wallet funded with ${formatNaira(value, false)}`,
        body: "Your top-up was received successfully.",
        time: "Just now",
      });
      setStage("done");
    }, 2200);
  };

  if (stage === "processing") {
    return (
      <AppShell>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
          <Loader2 className="size-12 animate-spin text-primary" />
          <h1 className="text-xl font-extrabold">Processing top-up</h1>
          <p className="text-sm text-muted-foreground">
            Adding {formatNaira(value, false)} to your wallet. Please don't close this page.
          </p>
        </div>
      </AppShell>
    );
  }

  if (stage === "done") {
    return (
      <AppShell>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="animate-in zoom-in grid size-20 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-10" />
          </span>
          <h1 className="text-2xl font-extrabold">Wallet Funded</h1>
          <p className="text-sm text-muted-foreground">
            {formatNaira(value, false)} was added to your wallet. Reference {txId}.
          </p>
          <div className="mt-4 w-full max-w-sm space-y-3">
            <Button className="h-13 w-full rounded-2xl font-bold" onClick={() => navigate({ to: "/wallet" })}>
              Back to Wallet
            </Button>
            <Button
              variant="outline"
              className="h-13 w-full rounded-2xl font-bold"
              onClick={() => navigate({ to: "/services" })}
            >
              Pay a bill
            </Button>
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
        </div>

        <Button onClick={start} className="h-13 w-full rounded-2xl text-base font-bold">
          Continue
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Demo only — no real payment gateway is connected.
        </p>
      </div>
    </AppShell>
  );
}
