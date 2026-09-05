import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Copy, FileWarning, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { CareContextLink } from "@/components/app/care-entry";
import { EmptyState, InfoRow, StatusBadge } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { friendlyError, useApp } from "@/lib/app-store";
import { formatNaira, maskTail } from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { requeryAirtime } from "@/lib/airtime.functions";
import { requeryBill } from "@/lib/bills.functions";

export const Route = createFileRoute("/history/$txId")({
  head: ({ params }) => ({
    meta: [
      { title: `Transaction ${params.txId} — ${BRAND.name}` },
      { name: "description", content: "Full receipt details for this transaction." },
      { property: "og:title", content: `Transaction ${params.txId} — ${BRAND.name}` },
      { property: "og:description", content: "View, share or report this payment." },
    ],
  }),
  component: TransactionDetails,
});

type BillExtra = {
  provider: string | null;
  provider_request_id: string | null;
  provider_transaction_id: string | null;
  provider_status: string | null;
  provider_channel: string | null;
  customer_identifier: string | null;
  service: string | null;
  status: string;
  amount: number;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function TransactionDetails() {
  const { txId } = Route.useParams();
  const { transactions, refresh } = useApp();
  const tx = transactions.find((t) => t.id === txId);
  const checkAirtime = useServerFn(requeryAirtime);
  const checkBill = useServerFn(requeryBill);
  const [bill, setBill] = useState<BillExtra | null>(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadBill = useCallback(async () => {
    if (!txId) return;
    setLoadingBill(true);
    try {
      const { data } = await supabase
        .from("bill_transactions")
        .select(
          "provider, provider_request_id, provider_transaction_id, provider_status, provider_channel, customer_identifier, service, status, amount, created_at, metadata",
        )
        .eq("internal_reference", txId)
        .maybeSingle();
      setBill((data as BillExtra) ?? null);
    } catch {
      setBill(null);
    } finally {
      setLoadingBill(false);
    }
  }, [txId]);

  useEffect(() => {
    void loadBill();
  }, [loadBill]);

  const isAirtime =
    tx?.serviceSlug === "airtime" ||
    bill?.service === "Airtime" ||
    (bill?.metadata as { service_slug?: string } | null)?.service_slug === "airtime";

  const status = bill?.status ?? tx?.status ?? "pending";
  const amount = bill?.amount != null ? Number(bill.amount) : (tx?.amount ?? 0);
  const network = bill?.provider ?? tx?.service?.split(" ")[0] ?? "";
  const phone =
    bill?.customer_identifier ?? (typeof tx?.reference === "string" ? tx.reference : "");
  const channel =
    bill?.provider_channel ||
    (typeof bill?.metadata?.["channel"] === "string" ? String(bill.metadata["channel"]) : null) ||
    (isAirtime ? "vtpass" : null);
  const providerRef = bill?.provider_request_id || bill?.provider_transaction_id || "";

  const canRequery =
    status === "pending" && Boolean(bill) && Boolean(bill.provider_request_id || isAirtime);

  const onRefresh = async () => {
    if (status !== "pending") return;
    setRefreshing(true);
    try {
      if (isAirtime) {
        await checkAirtime({ data: { reference: txId } });
      } else {
        await checkBill({ data: { reference: txId } });
      }
      await refresh();
      await loadBill();
      toast.success("Status updated");
    } catch (e) {
      toast.error(friendlyError(e, "Could not refresh status"));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (status !== "pending" || !bill) return;
    let cancelled = false;
    const run = async () => {
      try {
        if (isAirtime) {
          await checkAirtime({ data: { reference: txId } });
        } else {
          await checkBill({ data: { reference: txId } });
        }
        if (cancelled) return;
        await refresh();
        await loadBill();
      } catch {
        /* user can Refresh */
      }
    };
    const t = window.setTimeout(() => void run(), 600);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txId, status, isAirtime, bill?.provider_request_id]);

  const copy = (label: string, value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    toast.success(`${label} copied`);
  };

  if (!tx && !loadingBill && !bill) {
    return (
      <AppShell>
        <PageHeader title="Transaction Details" backTo="/history" />
        <div className="px-4 pt-6">
          <EmptyState
            Icon={FileWarning}
            title="Transaction not found"
            body="This receipt isn't available in your history. It may be older than what we load here."
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Transaction Details" backTo="/history" />
      <div className="space-y-4 px-4 pt-2 pb-6">
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-5 shadow-card">
          <img
            src={BRAND.logoUrl}
            alt={`${BRAND.name} logo`}
            className="h-[clamp(2.5rem,11vw,3.5rem)] w-auto object-contain"
          />
          <StatusBadge
            status={
              status === "successful" || status === "pending" || status === "failed"
                ? status
                : "pending"
            }
          />
          <p className="text-sm font-bold">{tx?.title ?? bill?.service ?? "Payment"}</p>
          <p className="text-3xl font-extrabold tabular-nums">
            {tx?.direction === "in" ? "+" : "-"}
            {formatNaira(amount, false)}
          </p>
          {status === "pending" ? (
            <p className="max-w-xs text-center text-xs text-muted-foreground">
              Your transaction is still being confirmed. Tap Refresh Status if this takes long.
            </p>
          ) : null}
        </div>

        <div className="divide-y rounded-2xl border bg-card px-4 py-2 shadow-card">
          {network ? (
            <InfoRow
              label="Network / Service"
              value={`${network}${bill?.service ? ` · ${bill.service}` : ""}`}
            />
          ) : null}
          {phone ? (
            <InfoRow
              label="Number"
              value={
                phone.startsWith("0") || phone.length >= 10
                  ? maskTail(phone.replace(/\D/g, ""))
                  : phone
              }
            />
          ) : null}
          <InfoRow label="Amount" value={formatNaira(amount)} />
          <div className="flex items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">RockPay Reference</p>
              <p className="truncate font-mono text-xs font-semibold">{txId}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 rounded-lg text-xs font-bold"
              onClick={() => copy("Reference", txId)}
            >
              <Copy className="size-3.5" /> Copy
            </Button>
          </div>
          {channel ? <InfoRow label="Channel" value={String(channel).toUpperCase()} /> : null}
          {providerRef ? (
            <div className="flex items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Provider Reference</p>
                <p className="truncate font-mono text-xs font-semibold">{providerRef}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 rounded-lg text-xs font-bold"
                onClick={() => copy("Provider ref", providerRef)}
              >
                <Copy className="size-3.5" /> Copy
              </Button>
            </div>
          ) : null}
          <InfoRow
            label="Date"
            value={
              bill?.created_at
                ? new Date(bill.created_at).toLocaleString("en-NG", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : `${tx?.date ?? ""} ${tx?.time ?? ""}`.trim()
            }
          />
          {tx?.method ? <InfoRow label="Payment Method" value={tx.method} /> : null}
        </div>

        {tx?.token ? (
          <div className="rounded-2xl border border-dashed bg-primary-soft p-4 text-center">
            <p className="text-xs font-semibold text-muted-foreground">Electricity Token</p>
            <p className="mt-1 text-lg font-extrabold tracking-[0.15em]">{tx.token}</p>
          </div>
        ) : null}

        <div className="space-y-2">
          {status === "pending" && canRequery ? (
            <Button
              className="h-12 w-full rounded-2xl font-bold"
              disabled={refreshing}
              onClick={() => void onRefresh()}
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh Status
            </Button>
          ) : null}
          {status === "failed" ? (
            <Button className="h-12 w-full rounded-2xl font-bold" asChild>
              <Link to="/pay/$slug" params={{ slug: "airtime" }}>
                Try Again
              </Link>
            </Button>
          ) : null}
          <CareContextLink
            reference={txId}
            status={
              status === "successful" || status === "pending" || status === "failed"
                ? status
                : "pending"
            }
          />
        </div>
      </div>
    </AppShell>
  );
}
