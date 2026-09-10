import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { asLooseRpc } from "@/lib/loose-rpc";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { formatNaira } from "@/lib/mock-data";
import { n, type ServiceRow } from "@/lib/admin";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin/services")({
  head: () => ({ meta: [{ title: `Services — ${BRAND.name} Admin` }] }),
  component: AdminServices,
});

type AvailabilityRow = { service_slug: string; is_enabled: boolean; updated_at: string };
const MANAGED_SERVICES = [
  ["airtime", "Airtime"],
  ["data", "Data"],
  ["electricity", "Electricity"],
  ["cable", "Cable TV"],
  ["education", "Education"],
  ["exam-pins", "Exam Pins"],
] as const;

function AdminServices() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [{ data: breakdown, error: breakdownError }, { data: settings, error: settingsError }] = await Promise.all([
        asLooseRpc(supabase.rpc)("admin_service_breakdown"),
        (supabase as unknown as { from: (t: string) => { select: (c: string) => { order: (c: string) => PromiseLike<{ data: unknown; error: { message: string } | null }> } } }).from("service_availability").select("service_slug, is_enabled, updated_at").order("service_slug"),
      ]);
      if (breakdownError) setError(breakdownError.message); else setRows(Array.isArray(breakdown) ? (breakdown as ServiceRow[]) : []);
      if (settingsError) setError((current) => current ?? settingsError.message); else setAvailability(Array.isArray(settings) ? (settings as unknown as AvailabilityRow[]) : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (slug: string, enabled: boolean) => {
    setSaving(slug); setError(null);
    const { error: err } = await asLooseRpc(supabase.rpc)("admin_set_service_availability", { _service_slug: slug, _enabled: enabled });
    if (err) setError(err.message);
    else setAvailability((current) => current.map((row) => row.service_slug === slug ? { ...row, is_enabled: enabled, updated_at: new Date().toISOString() } : row));
    setSaving(null);
  };

  const isEnabled = (slug: string) => availability.find((row) => row.service_slug === slug)?.is_enabled ?? false;

  return (
    <AdminShell title="Services" subtitle="Control what customers can see and purchase">
      {error ? <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      <section className="mb-6 rounded-2xl border bg-card p-4 shadow-card">
        <h2 className="text-base font-extrabold">Public availability</h2>
        <p className="mt-1 mb-3 text-xs text-muted-foreground">Disabled services are hidden from customers and blocked at transaction creation.</p>
        <div className="divide-y rounded-xl border">
          {MANAGED_SERVICES.map(([slug, label]) => {
            const enabled = isEnabled(slug); const busy = saving === slug;
            return <div key={slug} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <div><p className="text-sm font-bold">{label}</p><p className="text-[11px] text-muted-foreground">{enabled ? "Visible and purchasable" : "Hidden and blocked"}</p></div>
              <button type="button" role="switch" aria-checked={enabled} aria-label={`${enabled ? "Disable" : "Enable"} ${label}`} disabled={busy} onClick={() => void toggle(slug, !enabled)} className={`relative h-7 w-12 shrink-0 rounded-full transition-opacity disabled:opacity-50 ${enabled ? "bg-primary" : "bg-muted"}`}>
                <span className={`absolute top-1 size-5 rounded-full bg-background shadow-sm transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>;
          })}
        </div>
      </section>
      <p className="mb-4 text-xs text-muted-foreground">Performance comes from <code>bill_transactions</code>. Provider and plan data remain dynamic from VTpass.</p>
      {loading ? <AdminLoading /> : rows.length === 0 ? <AdminEmpty title="No service data yet" body="When customers pay bills, success rates appear here." /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => { const rate = s.total ? Math.round((s.successful / s.total) * 1000) / 10 : 0; return <div key={s.service} className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="text-sm font-extrabold capitalize">{s.service}</p><p className="mt-2 text-2xl font-extrabold">{rate}%</p><p className="text-xs text-muted-foreground">Success rate</p>
          <dl className="mt-3 space-y-1 text-xs"><div className="flex justify-between"><dt>Total</dt><dd className="font-bold">{s.total}</dd></div><div className="flex justify-between"><dt>Successful</dt><dd className="font-bold">{s.successful}</dd></div><div className="flex justify-between"><dt>Pending</dt><dd className="font-bold">{s.pending}</dd></div><div className="flex justify-between"><dt>Failed</dt><dd className="font-bold">{s.failed}</dd></div><div className="flex justify-between"><dt>Volume</dt><dd className="font-bold">{formatNaira(n(s.volume), false)}</dd></div></dl>
        </div>; })}
      </div>}
    </AdminShell>
  );
}
