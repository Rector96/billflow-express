import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/pricing")({
  head: () => ({ meta: [{ title: `Pricing — ${BRAND.name} Admin` }] }),
  component: AdminPricing,
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

function AdminPricing() {
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
    <AdminShell
      title="Pricing"
      subtitle="Markup rules applied server-side before provider purchase"
    >
      <p className="mb-4 text-xs text-muted-foreground">
        Rules live in <code>pricing_rules</code>. Customer amounts and profit are computed on the
        server only. Airtime uses face-value debit; other services use these markups when active.
      </p>
      {error ? (
        <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
          <span className="mt-1 block text-xs">
            Apply pricing migrations and run docs/SQL_ADMIN_WALLET_AND_CARE.sql for SELECT grant.
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
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Service</th>
                <th className="px-3 py-2.5 font-semibold">Provider</th>
                <th className="px-3 py-2.5 font-semibold">Product</th>
                <th className="px-3 py-2.5 font-semibold">Type</th>
                <th className="px-3 py-2.5 font-semibold">Value</th>
                <th className="px-3 py-2.5 font-semibold">Range</th>
                <th className="px-3 py-2.5 font-semibold">Priority</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2.5 font-semibold capitalize">{r.service}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.provider || "All"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.product_code || "—"}
                  </td>
                  <td className="px-3 py-2.5 capitalize">{r.markup_type.replace("_", " ")}</td>
                  <td className="px-3 py-2.5 font-bold">
                    {r.markup_type === "percentage"
                      ? `${r.markup_value}%`
                      : `₦${Number(r.markup_value).toLocaleString("en-NG")}`}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.min_amount != null || r.max_amount != null
                      ? `${r.min_amount ?? "0"} – ${r.max_amount ?? "∞"}`
                      : "Any"}
                  </td>
                  <td className="px-3 py-2.5">{r.priority}</td>
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
    </AdminShell>
  );
}
