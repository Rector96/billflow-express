import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell, KpiCard } from "@/components/admin/admin-shell";
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

type WalletReconciliation = {
  wallet_count: number;
  wallet_balance_total: number;
  ledger_deposit_total: number;
  ledger_debit_total: number;
  ledger_refund_total: number;
  pending_funding_count: number;
  pending_funding_total: number;
  anomalies: Array<{
    issue: string;
    severity: string;
    wallet_id: string;
    user_id: string;
    user_label: string | null;
    user_email: string | null;
    current_balance: number;
    created_at: string;
    detail: string;
  }>;
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
  const [wallet, setWallet] = useState<WalletReconciliation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [txResult, walletResult] = await Promise.all([
        supabase.rpc("admin_reconciliation_queue", { _limit: 100 }),
        (supabase.rpc as any)("admin_wallet_reconciliation", {
          _limit: 100,
          _offset: 0,
        }),
      ]);

      if (txResult.error) throw txResult.error;
      if (walletResult.error) throw walletResult.error;

      setRows(Array.isArray(txResult.data) ? (txResult.data as QueueRow[]) : []);
      setWallet((walletResult.data ?? null) as WalletReconciliation | null);
    } catch (e) {
      setError(friendlyError(e, "Could not load reconciliation data"));
      setRows([]);
      setWallet(null);
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
      subtitle="Financial integrity and transactions that need staff attention"
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
          {error}
        </div>
      ) : null}

      {loading ? (
        <AdminLoading label="Loading reconciliation…" />
      ) : (
        <>
          {wallet ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Wallet liability" value={formatNaira(n(wallet.wallet_balance_total), false)} />
              <KpiCard label="Successful deposits" value={formatNaira(n(wallet.ledger_deposit_total), false)} />
              <KpiCard label="Successful debits" value={formatNaira(n(wallet.ledger_debit_total), false)} />
              <KpiCard
                label="Pending funding"
                value={`${n(wallet.pending_funding_count)} · ${formatNaira(n(wallet.pending_funding_total), false)}`}
              />
            </div>
          ) : null}

          {wallet?.anomalies?.length ? (
            <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive-soft p-4">
              <p className="font-bold text-destructive">Wallet anomalies detected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                These are read-only alerts. Do not manually alter balances; investigate the underlying ledger first.
              </p>
              <div className="mt-3 space-y-2">
                {wallet.anomalies.map((a, index) => (
                  <div key={`${a.issue}-${a.wallet_id}-${a.created_at}-${index}`} className="rounded-xl border bg-card p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{a.user_label || "Unknown customer"}</p>
                        <p className="text-xs text-muted-foreground">{a.user_email || a.user_id}</p>
                        <p className="mt-1 text-xs font-semibold">{a.detail}</p>
                      </div>
                      <div className="text-right text-xs">
                        <span className="font-bold uppercase">{a.severity}</span>
                        <p className="text-muted-foreground">{new Date(a.created_at).toLocaleString("en-NG")}</p>
                      </div>
                    </div>
                    <Link
                      to="/admin/users/$userId"
                      params={{ userId: a.user_id }}
                      className="mt-2 inline-block rounded-lg border px-3 py-1.5 text-xs font-bold"
                    >
                      Open customer
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border bg-card p-4 text-sm">
              <p className="font-bold">Wallet integrity check passed</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No wallet balance-chain, funding-delta, or stale-funding anomalies were returned.
              </p>
            </div>
          )}

          <div className="mt-5">
            <p className="mb-2 text-sm font-bold">Bill transaction reconciliation</p>
            {rows.length === 0 ? (
              <AdminEmpty
                title="Everything is reconciled."
                body="No transaction mismatches or stale pending bills right now."
              />
            ) : (
              <div className="space-y-2">
                {rows.map((r) => {
                  const st =
                    r.rockpay_status === "successful" ||
                    r.rockpay_status === "pending" ||
                    r.rockpay_status === "failed"
                      ? r.rockpay_status
                      : "pending";
                  return (
                    <div key={r.id} className="rounded-2xl border bg-card p-4 text-sm shadow-card">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold">{r.service} · {r.provider}</p>
                          <p className="text-xs font-semibold text-warning-foreground">
                            {REASON_LABEL[r.reason] ?? r.reason}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{r.internal_reference}</p>
                          {r.provider_request_id ? (
                            <p className="font-mono text-[11px] text-muted-foreground">VTpass req: {r.provider_request_id}</p>
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
          </div>
        </>
      )}
    </AdminShell>
  );
}
