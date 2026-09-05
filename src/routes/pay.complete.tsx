import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Clock, Copy, Home, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { friendlyError, useApp } from "@/lib/app-store";
import { formatNaira } from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { verifyAndFulfillDirectBill } from "@/lib/direct-bill.functions";

export const Route = createFileRoute("/pay/complete")({
  head: () => ({
    meta: [
      { title: `Confirming payment — ${BRAND.name}` },
      { name: "description", content: "Confirming your bill payment." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { reference?: string } => {
    const ref =
      typeof search["reference"] === "string"
        ? (search["reference"] as string)
        : typeof search["trxref"] === "string"
          ? (search["trxref"] as string)
          : undefined;
    return ref ? { reference: ref } : {};
  },
  component: PayCompletePage,
});

type Stage = "confirming" | "successful" | "pending" | "failed" | "missing";

function PayCompletePage() {
  const navigate = useNavigate();
  const { refresh } = useApp();
  const { reference } = Route.useSearch();
  const verify = useServerFn(verifyAndFulfillDirectBill);
  const [stage, setStage] = useState<Stage>(reference ? "confirming" : "missing");
  const [result, setResult] = useState<{
    billReference: string;
    amount: number;
    token: string | null;
    message: string;
  } | null>(null);
  const done = useRef<string | null>(null);

  const run = useCallback(
    async (ref: string) => {
      setStage("confirming");
      try {
        const res = await verify({ data: { reference: ref } });
        setResult({
          billReference: res.billReference,
          amount: res.amount,
          token: res.token,
          message: res.message,
        });
        setStage(res.status);
        await refresh();
      } catch (err) {
        setStage("pending");
        toast.error(friendlyError(err, "Could not confirm this payment yet."));
      }
    },
    [verify, refresh],
  );

  useEffect(() => {
    if (!reference || done.current === reference) return;
    done.current = reference;
    void run(reference);
  }, [reference, run]);

  const copyToken = async () => {
    if (!result?.token) return;
    try {
      await navigator.clipboard.writeText(result.token.replace(/\s/g, ""));
      toast.success("Token copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  if (stage === "missing") {
    return (
      <AppShell>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-muted-foreground">No payment reference found.</p>
          <Button className="rounded-2xl font-bold" onClick={() => navigate({ to: "/home" })}>
            Go home
          </Button>
        </div>
      </AppShell>
    );
  }

  if (stage === "confirming") {
    return (
      <AppShell>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
          <Loader2 className="size-12 animate-spin text-primary" />
          <h1 className="text-xl font-extrabold">Confirming your payment</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Verifying Paystack and completing your bill with the provider. Do not close this page.
          </p>
        </div>
      </AppShell>
    );
  }

  const meta = {
    successful: {
      icon: CheckCircle2,
      tone: "bg-success-soft text-success",
      title: "Payment successful",
    },
    pending: {
      icon: Clock,
      tone: "bg-warning-soft text-warning",
      title: "Still confirming",
    },
    failed: {
      icon: AlertTriangle,
      tone: "bg-destructive-soft text-destructive",
      title: "Could not complete",
    },
  }[stage as "successful" | "pending" | "failed"];

  return (
    <AppShell>
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 py-8 text-center sm:px-6">
        <span className={cn("grid size-20 place-items-center rounded-full", meta.tone)}>
          <meta.icon className="size-10" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">{meta.title}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{result?.message}</p>

        {result?.token ? (
          <div className="w-full max-w-sm rounded-2xl border bg-card p-4 text-left shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Electricity token
            </p>
            <p className="mt-1 break-all font-mono text-lg font-extrabold tracking-wide">{result.token}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3 rounded-xl" onClick={() => void copyToken()}>
              <Copy className="mr-1.5 size-3.5" /> Copy token
            </Button>
          </div>
        ) : null}

        <div className="w-full max-w-sm rounded-2xl border bg-card p-4 text-left text-sm shadow-card">
          <div className="flex justify-between gap-3 py-1.5">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-bold">{formatNaira(result?.amount ?? 0)}</span>
          </div>
          {result?.billReference ? (
            <div className="flex justify-between gap-3 py-1.5">
              <span className="text-muted-foreground">Reference</span>
              <span className="max-w-[60%] truncate font-mono text-xs font-bold">{result.billReference}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-2 w-full max-w-sm space-y-3">
          {stage === "pending" ? (
            <Button className="h-13 w-full rounded-2xl font-bold" onClick={() => reference && void run(reference)}>
              <RefreshCw className="mr-2 size-4" /> Refresh status
            </Button>
          ) : null}
          <Button className="h-13 w-full rounded-2xl font-bold" onClick={() => navigate({ to: "/home" })}>
            <Home className="mr-2 size-4" /> Go to Home
          </Button>
          {stage === "failed" ? (
            <Button variant="outline" className="h-13 w-full rounded-2xl font-bold" asChild>
              <Link to="/support">Open Care</Link>
            </Button>
          ) : (
            <Button variant="outline" className="h-13 w-full rounded-2xl font-bold" onClick={() => navigate({ to: "/history" })}>
              View History
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
