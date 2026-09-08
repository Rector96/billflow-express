import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell, KpiCard } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/app/ui-bits";
import { formatNaira, type TxStatus } from "@/lib/mock-data";
import { n, type OpsStats } from "@/lib/admin";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin/wallet")({
  head: () => ({ meta: [{ title: `Wallet — ${BRAND.name} Admin` }] }),
  component: AdminWallet,
});

type FundingRow = {
  id: string;
  reference: string;
  providerReference: string | null;
  providerTransactionId: string | null;
  amount: number;
  status: TxStatus;
  createdAt: string;
  completedAt: string | null;
  userLabel: string;
  userEmail: string;
  userPhone: string;
  balanceBefore: number;
  balanceAfter: number;
};

function AdminWallet() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OpsStats>({});
  const [rows, setRows] = useState<FundingRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, funding] = await Promise.all([
        supabase.rpc("admin_ops_stats"),
        // This RPC is introduced by the wallet hardening migration. Keep the
        // generated Supabase client compatible until types are regenerated.
        (supabase.rpc as any)("admin_wallet_funding_queue", {
          _query: query.trim(),
          _status: status,
          _limit: 50,
          _offset: page * 50,
        }),
      ]);

      if (ops.data && typeof ops.data === "object") setStats(ops.data as OpsStats);

      if (funding.error) throw funding.error;
      const payload = (funding.data ?? {}) as {
        total_count?: number;
        rows?: Array<{
          id: string;
          reference: string;
          provider_reference: string | null;
          provider_transaction_id: string | null;
          amount: number;
          status: string;
          created_at: string;
          completed_at: string | null;
          user_label: string | null;
          user_email: string | null;
          user_phone: string | null;
          balance_before: number;
          balance_after: number;
        }>;
      };

      setTotalCount(n(payload.total_count));
      setRows(
        (payload.rows ?? []).map((r) => ({
          id: r.id,
          reference: r.reference,
          providerReference: r.provider_reference,
          providerTransactionId: r.provider_transaction_id,
          amount: n(r.amount),
          status: (r.status === "successful" || r.status === "pending" || r.status === "failed"
            ? r.status
            : "pending") as TxStatus,
          createdAt: r.created_at,
          completedAt: r.completed_at,
          userLabel: r.user_label || "Unknown customer",
          userEmail: r.user_email || "",
          userPhone: r.user_phone || "",
          balanceBefore: n(r.balance_before),
          balanceAfter: n(r.balance_after),
        })),
      );
    } catch (error) {
      console.error("[AdminWallet] failed to load", error);
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [query, status]);

  const pageCount = Math.max(1, Math.ceil(totalCount / 50));

  return (
    <AdminShell title="Wallet" subtitle="Platform liability and ledger activity">
      {loading ? (
        <AdminLoading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Total liability (balances)"
              value={formatNaira(n(stats.wallet_balance_total), false)}
            />
            <KpiCard label="Total funding" value={formatNaira(n(stats.funding_total), false)} />
            <KpiCard label="Total debits" value={formatNaira(n(stats.debits_total), false)} />
            <KpiCard label="Total refunds" value={formatNaira(n(stats.refunds_total), false)} />
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Wallet balances remain server-controlled. Manual adjustments are not enabled in the UI;
            any future adjustment must use a confirmed, audited server operation.
          </p>

          <div className="mt-5 rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold">Funding operations</p>
                <p className="text-xs text-muted-foreground">
                  Paystack deposits only; search is processed server-side.
                </p>
              </div>
              <div className="flex gap-2">
                {[
                  ["all", "All"],
                  ["successful", "Successful"],
                  ["pending", "Pending"],
                  ["failed", "Failed"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      status === value ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reference, customer, email, phone…"
              className="mt-4 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />

            <div className="mt-4 space-y-2">
              {rows.length === 0 ? (
                <AdminEmpty title="No funding records" body="Matching wallet deposits will appear here." />
              ) : (
                rows.map((r) => (
                  <div key={r.id} className="rounded-xl border px-3 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{r.userLabel}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[r.userEmail, r.userPhone].filter(Boolean).join(" · ") || "Customer details unavailable"}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {r.reference}
                          {r.providerReference && r.providerReference !== r.reference
                            ? ` · ${r.providerReference}`
                            : ""}
                        </p>
                        {r.providerTransactionId ? (
                          <p className="font-mono text-[10px] text-muted-foreground">
                            Paystack ID: {r.providerTransactionId}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatNaira(r.amount, false)}</p>
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Before: {formatNaira(r.balanceBefore, false)}</span>
                      <span>After: {formatNaira(r.balanceAfter, false)}</span>
                      <span>{new Date(r.createdAt).toLocaleString("en-NG")}</span>
                      {r.completedAt ? <span>Completed {new Date(r.completedAt).toLocaleString("en-NG")}</span> : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {totalCount === 0 ? "0 records" : `${page * 50 + 1}–${Math.min((page + 1) * 50, totalCount)} of ${totalCount}`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page + 1 >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
