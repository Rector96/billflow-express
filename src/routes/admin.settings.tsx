import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: `Settings — ${BRAND.name} Admin` }] }),
  component: AdminSettings,
});

type Rule = {
  id: string;
  service: string;
  provider: string | null;
  product_code: string | null;
  markup_type: string;
  markup_value: number;
  min_amount: number | null;
  max_amount: number | null;
  is_active: boolean;
  priority: number;
};

function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("pricing_rules")
        .select(
          "id, service, provider, product_code, markup_type, markup_value, min_amount, max_amount, is_active, priority",
        )
        .order("service", { ascending: true })
        .order("priority", { ascending: false });
      if (err) {
        setError(err.message);
        setRows([]);
        return;
      }
      setRows((data as Rule[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell title="Settings" subtitle="Pricing, providers and operational notes">
      <div className="space-y-6 text-sm">
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-extrabold tracking-tight">Pricing & markups</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Rules in <code>pricing_rules</code>. Applied server-side only. Airtime is face-value
              (customer pays what the phone receives).
            </p>
          </div>
          {error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
              <span className="mt-1 block text-xs">
                Apply pricing migrations and docs/SQL_ADMIN_WALLET_AND_CARE.sql for SELECT grant.
              </span>
            </p>
          ) : null}
          {loading ? (
            <AdminLoading />
          ) : rows.length === 0 ? (
            <AdminEmpty
              title="No pricing rules"
              body="Run the pricing_rules seed migration, then refresh."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Service</th>
                    <th className="px-3 py-2.5 font-semibold">Provider</th>
                    <th className="px-3 py-2.5 font-semibold">Product</th>
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">Value</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-3 py-2.5 font-semibold capitalize">{r.service}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.provider || "All"}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                        {r.product_code || "—"}
                      </td>
                      <td className="px-3 py-2.5 capitalize">{r.markup_type.replace("_", " ")}</td>
                      <td className="px-3 py-2.5 font-bold">
                        {r.markup_type === "percentage"
                          ? `${r.markup_value}%`
                          : `₦${Number(r.markup_value).toLocaleString("en-NG")}`}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            r.is_active
                              ? "bg-emerald-500/15 text-emerald-700"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {r.is_active ? "Active" : "Off"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">Paystack</p>
          <p className="mt-1 text-muted-foreground">
            Test mode is enforced in server code (<code>sk_test_</code> only). Secrets live on
            Netlify only.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">Staff access</p>
          <p className="mt-1 text-muted-foreground">
            Roles in <code>user_roles</code>: super_admin, admin, support. Assign via Supabase SQL.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
