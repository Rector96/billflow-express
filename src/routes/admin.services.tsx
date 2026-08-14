import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { formatNaira } from "@/lib/mock-data";
import { n, type ServiceRow } from "@/lib/admin";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin/services")({
  head: () => ({ meta: [{ title: `Services — ${BRAND.name} Admin` }] }),
  component: AdminServices,
});

function AdminServices() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc("admin_service_breakdown");
      if (err) setError(err.message);
      setRows(Array.isArray(data) ? (data as ServiceRow[]) : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell title="Services" subtitle="Bill payment performance by service">
      {error ? (
        <p className="mb-3 text-sm text-destructive">{error}</p>
      ) : null}
      <p className="mb-4 text-xs text-muted-foreground">
        Prepared for VTpass monitoring. Counts come from <code>bill_transactions</code> only — no fabricated
        providers.
      </p>
      {loading ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty title="No service data yet" body="When customers pay bills, success rates appear here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => {
            const rate = s.total ? Math.round((s.successful / s.total) * 1000) / 10 : 0;
            return (
              <div key={s.service} className="rounded-2xl border bg-card p-4 shadow-card">
                <p className="text-sm font-extrabold capitalize">{s.service}</p>
                <p className="mt-2 text-2xl font-extrabold">{rate}%</p>
                <p className="text-xs text-muted-foreground">Success rate</p>
                <dl className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total</dt>
                    <dd className="font-bold">{s.total}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Successful</dt>
                    <dd className="font-bold">{s.successful}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Pending</dt>
                    <dd className="font-bold">{s.pending}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Failed</dt>
                    <dd className="font-bold">{s.failed}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Volume</dt>
                    <dd className="font-bold">{formatNaira(n(s.volume), false)}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
