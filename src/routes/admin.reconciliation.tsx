import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/app/ui-bits";
import { formatNaira } from "@/lib/mock-data";
import { formatPendingDuration } from "@/lib/reconciliation";
import { n } from "@/lib/admin";
import { BRAND } from "@/lib/brand";
import { friendlyError } from "@/lib/app-store";

export const Route = createFileRoute("/admin/reconciliation")({
  head: () => ({ meta: [{ title: `Reconciliation — ${BRAND.name} Admin` }] }),
  component: AdminReconciliation,
});

type QueueRow = {
  id: string;
  internal_reference: string;
  service: string;
  provider: string;
  amount: number;
  rockpay_status: string;
  provider_status: string | null;
  provider_response_code: string | null;
  provider_request_id: string | null;
  provider_transaction_id: string | null;
  provider_channel: string | null;
  customer_identifier: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  reason: string;
};

const REASON_LABEL: Record<string, string> = {
  provider_success_rockpay_pending: "Provider success · RockPay pending",
  provider_success_rockpay_failed: "Provider success · RockPay failed",
  provider_failed_rockpay_success: "Provider failed · RockPay success",
  missing_provider_reference: "Missing provider reference",
  stale_pending: "Stale pending (>15 min)",
  awaiting_provider_response: "Awaiting provider response",
  other: "Needs review",
};

function AdminReconciliation() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc("admin_reconciliation_queue", { _limit: 100 });
      if (err) throw err;
      setRows(Array.isArray(data) ? (data as QueueRow[]) : []);
    } catch (e) {
      setError(friendlyError(e, "Could not load reconciliation queue"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell
      title="Reconciliation"
      subtitle="Transactions that need staff attention"
      actions={
        <button
          type="button"
          onClick={() => void load()}
          className="press flex h-10 items-center gap-2 rounded-xl border bg-card px-3 text-xs font-bold"
        >
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          Refresh
        </button>
      }
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {error}. Apply migration <code className="text-xs">20260814190000_transaction_reconciliation.sql</code> if the RPC is missing.
        </div>
      ) : null}

      {loading ? (
        <AdminLoading label="Loading queue…" />
      ) : rows.length === 0 ? (
        <AdminEmpty title="Everything is reconciled." body="No mismatches or stale pending bills right now." />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const st =
              r.rockpay_status === "successful" || r.rockpay_status === "pending" || r.rockpay_status === "failed"
                ? r.rockpay_status
                : "pending";
            return (
              <div key={r.id} className="rounded-2xl border bg-card p-4 text-sm shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {r.service} · {r.provider}
                    </p>
                    <p className="text-xs font-semibold text-warning-foreground">
                      {REASON_LABEL[r.reason] ?? r.reason}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{r.internal_reference}</p>
                    {r.provider_request_id ? (
                      <p className="font-mono text-[11px] text-muted-foreground">
                        VTpass req: {r.provider_request_id}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("en-NG")} · pending {formatPendingDuration(r.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold">{formatNaira(n(r.amount), false)}</p>
                    <StatusBadge status={st} />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Provider: {r.provider_status || r.provider_response_code || "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/admin/transactions"
                    search={{ q: r.internal_reference, status: "all" }}
                    className="rounded-xl border px-3 py-1.5 text-xs font-bold"
                  >
                    Investigate
                  </Link>
                  <Link
                    to="/admin/care"
                    search={{ q: r.internal_reference }}
                    className="rounded-xl border px-3 py-1.5 text-xs font-bold"
                  >
                    Care
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
