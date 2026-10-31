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
  ["electricity", "Electricity"],
  ["cable", "Cable TV"],
] as const;

const SERVICE_CATALOG = [
  {
    name: "CAC registration",
    state: "Live · manual processing",
    detail:
      "Customer submits details and pays; staff process through the authorized CAC portal and upload the certificate.",
  },
  {
    name: "Electricity",
    state: "Live · VTpass",
    detail: "Wallet payment and provider fulfilment. Availability can be switched off below.",
  },
  {
    name: "Cable TV",
    state: "Live · VTpass",
    detail: "Wallet payment and provider fulfilment. Availability can be switched off below.",
  },
  {
    name: "NIN, TIN, documents, vehicle, education and exam PINs",
    state: "Preview / operations preparation",
    detail:
      "Flows may collect preview information, but must not take payment while the service is not live.",
  },
  {
    name: "Airtime and data",
    state: "Removed",
    detail: "Hidden from the customer product and not available for new purchases.",
  },
] as const;

function AdminServices() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: breakdown, error: breakdownError }, { data: settings, error: settingsError }] =
        await Promise.all([
          asLooseRpc(supabase.rpc)("admin_service_breakdown"),
          (
            supabase as unknown as {
              from: (t: string) => {
                select: (c: string) => {
                  order: (
                    c: string,
                  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
                };
              };
            }
          )
            .from("service_availability")
            .select("service_slug, is_enabled, updated_at")
            .order("service_slug"),
        ]);
      if (breakdownError) throw breakdownError;
      if (settingsError) throw settingsError;
      setRows(Array.isArray(breakdown) ? (breakdown as ServiceRow[]) : []);
      setAvailability(Array.isArray(settings) ? (settings as AvailabilityRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load service operations");
      setRows([]);
      setAvailability([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (slug: string, enabled: boolean) => {
    setSaving(slug);
    setError(null);
    try {
      const { error: err } = await asLooseRpc(supabase.rpc)("admin_set_service_availability", {
        _service_slug: slug,
        _enabled: enabled,
      });
      if (err) throw err;
      setAvailability((current) => {
        const existing = current.find((row) => row.service_slug === slug);
        if (existing)
          return current.map((row) =>
            row.service_slug === slug
              ? { ...row, is_enabled: enabled, updated_at: new Date().toISOString() }
              : row,
          );
        return [
          ...current,
          { service_slug: slug, is_enabled: enabled, updated_at: new Date().toISOString() },
        ];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update service availability");
    } finally {
      setSaving(null);
    }
  };

  const isEnabled = (slug: string) =>
    availability.find((row) => row.service_slug === slug)?.is_enabled ?? false;

  return (
    <AdminShell title="Services" subtitle="Live, manual, preview and removed service operations">
      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
          <p className="mt-1 text-xs">
            Check that the service availability and admin operations migrations have been applied,
            then refresh.
          </p>
        </div>
      ) : null}

      <section className="mb-5 rounded-2xl border bg-card p-4 shadow-card">
        <h2 className="text-base font-extrabold">RockPay service catalogue</h2>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">
          This catalogue reflects the actual customer product and fulfilment modes. Historical
          airtime/data transactions may still appear in reports.
        </p>
        <div className="space-y-2">
          {SERVICE_CATALOG.map((service) => (
            <div key={service.name} className="rounded-xl border border-border/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{service.name}</p>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold">
                  {service.state}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{service.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border bg-card p-4 shadow-card">
        <h2 className="text-base font-extrabold">VTpass bill availability</h2>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">
          These two services are controlled by the database availability switch and are also checked
          when a bill transaction is created. This does not turn preview-only services live.
        </p>
        <div className="divide-y rounded-xl border">
          {MANAGED_SERVICES.map(([slug, label]) => {
            const enabled = isEnabled(slug);
            const busy = saving === slug;
            return (
              <div key={slug} className="flex items-center justify-between gap-3 px-3.5 py-3">
                <div>
                  <p className="text-sm font-bold">{label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {enabled ? "Available for customer purchases" : "Disabled for new purchases"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Last changed:{" "}
                    {availability.find((row) => row.service_slug === slug)?.updated_at
                      ? new Date(
                          availability.find((row) => row.service_slug === slug)!.updated_at,
                        ).toLocaleString("en-NG")
                      : "Not recorded"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${enabled ? "Disable" : "Enable"} ${label}`}
                  disabled={busy || loading}
                  onClick={() => void toggle(slug, !enabled)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-opacity disabled:opacity-50 ${enabled ? "bg-primary" : "bg-muted"}`}
                >
                  <span
                    className={`absolute top-1 size-5 rounded-full bg-background shadow-sm transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <p className="mb-3 text-xs text-muted-foreground">
        Performance below is historical data from bill_transactions; it does not imply that a
        removed or preview-only service is currently purchasable.
      </p>
      {loading ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty
          title="No bill transaction history"
          body="Service performance will appear after bill transactions are recorded."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => {
            const rate = s.total ? Math.round((s.successful / s.total) * 1000) / 10 : 0;
            return (
              <div key={s.service} className="rounded-2xl border bg-card p-4 shadow-card">
                <p className="text-sm font-extrabold capitalize">{s.service}</p>
                <p className="mt-2 text-2xl font-extrabold">{rate}%</p>
                <p className="text-xs text-muted-foreground">Historical success rate</p>
                <dl className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <dt>Total</dt>
                    <dd className="font-bold">{s.total}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Successful</dt>
                    <dd className="font-bold">{s.successful}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Pending</dt>
                    <dd className="font-bold">{s.pending}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Failed</dt>
                    <dd className="font-bold">{s.failed}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Volume</dt>
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
