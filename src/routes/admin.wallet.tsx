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

function AdminWallet() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OpsStats>({});
  const [rows, setRows] = useState<
    {
      id: string;
      reference: string;
      amount: number;
      status: TxStatus;
      type: string;
      created_at: string;
    }[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, tx] = await Promise.all([
        supabase.rpc("admin_ops_stats"),
        supabase
          .from("wallet_transactions")
          .select("id, reference, amount, status, type, created_at, provider_reference")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (ops.data && typeof ops.data === "object") setStats(ops.data as OpsStats);
      setRows(
        (tx.data ?? []).map((t) => ({
          id: t.id,
          reference: t.provider_reference || t.reference,
          amount: n(t.amount),
          status: (t.status === "successful" || t.status === "pending" || t.status === "failed"
            ? t.status
            : "pending") as TxStatus,
          type: t.type,
          created_at: t.created_at,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
            Manual wallet adjustments are not enabled in the UI. Any future adjustment must use a
            confirmed, audited server RPC (reason + staff id + timestamp).
          </p>
          <div className="mt-5 rounded-2xl border bg-card p-4 shadow-card">
            <p className="mb-3 text-sm font-bold">Recent wallet activity</p>
            {rows.length === 0 ? (
              <AdminEmpty title="No wallet activity" body="Ledger rows will appear here." />
            ) : (
              <div className="space-y-2">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="flex justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{r.type}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{r.reference}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("en-NG")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatNaira(r.amount, false)}</p>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AdminShell>
  );
}
