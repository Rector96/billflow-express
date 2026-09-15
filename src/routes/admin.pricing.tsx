/**
 * Admin pricing — Tab 1 bill markups | Tab 2 hub catalog fees (markup_value).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HUB_CATALOG_SERVICES,
  listHubCatalogFees,
  updateHubCatalogFee,
} from "@/lib/admin-hub.functions";
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

const BILL_SERVICES = new Set(["airtime", "data", "cable", "electricity"]);

function AdminPricing() {
  const [tab, setTab] = useState<"bills" | "hub">("bills");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runHubList = useServerFn(listHubCatalogFees);
  const runHubSave = useServerFn(updateHubCatalogFee);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);
  const [hubDrafts, setHubDrafts] = useState<Record<string, string>>({});
  const [savingService, setSavingService] = useState<string | null>(null);

  const loadBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              order: (
                a: string,
                o: { ascending: boolean },
              ) => {
                order: (
                  a: string,
                  o: { ascending: boolean },
                ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
              };
            };
          };
        }
      )
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
      setRows((data as unknown as Rule[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHub = useCallback(async () => {
    setHubLoading(true);
    setHubError(null);
    try {
      const res = await runHubList();
      const map: Record<string, string> = {};
      for (const s of HUB_CATALOG_SERVICES) map[s] = "";
      for (const r of res.rules as { service?: string; markup_value?: number }[]) {
        const svc = String(r.service ?? "");
        if (svc) map[svc] = String(Math.round(Number(r.markup_value ?? 0)));
      }
      setHubDrafts(map);
    } catch (e) {
      setHubError(e instanceof Error ? e.message : "Failed to load hub fees");
    } finally {
      setHubLoading(false);
    }
  }, [runHubList]);

  useEffect(() => {
    void loadBills();
  }, [loadBills]);

  useEffect(() => {
    if (tab === "hub") void loadHub();
  }, [tab, loadHub]);

  const billRows = useMemo(() => rows.filter((r) => BILL_SERVICES.has(r.service)), [rows]);

  const saveHub = async (service: string) => {
    const raw = hubDrafts[service] ?? "";
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid fee in Naira");
      return;
    }
    setSavingService(service);
    try {
      await runHubSave({ data: { service, markupValue: value } });
      toast.success(`${service} → ₦${value.toLocaleString("en-NG")}`);
      await loadHub();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingService(null);
    }
  };

  return (
    <AdminShell
      title="Pricing"
      subtitle="Bill markups and identity/hub catalog fees (server-side only)"
    >
      <div className="mb-4 flex gap-2 rounded-2xl border bg-muted/30 p-1">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-xl px-3 py-2 text-xs font-bold",
            tab === "bills" ? "bg-card shadow-soft" : "text-muted-foreground",
          )}
          onClick={() => setTab("bills")}
        >
          VTpass bill markups
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-xl px-3 py-2 text-xs font-bold",
            tab === "hub" ? "bg-card shadow-soft" : "text-muted-foreground",
          )}
          onClick={() => setTab("hub")}
        >
          Identity & hub catalog fees
        </button>
      </div>

      {tab === "bills" ? (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            Rules use <code>markup_type</code> / <code>markup_value</code> on{" "}
            <code>pricing_rules</code>. Airtime stays face-value when markup is zero.
          </p>
          {error ? (
            <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {loading ? (
            <AdminLoading />
          ) : billRows.length === 0 ? (
            <AdminEmpty title="No bill pricing rules" body="Seed airtime/data/cable/electricity rules." />
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
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {billRows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-3 py-2.5 font-semibold capitalize">{r.service}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.provider || "All"}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.product_code || "—"}</td>
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
        </>
      ) : (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            Hub fees are stored as <code>selling_price</code> in <code>markup_value</code> (not{" "}
            <code>base_price</code>). Customer loaders read these on each visit. Expand{" "}
            <code>pricing_rules_service_check</code> before first save if inserts fail.
          </p>
          {hubError ? (
            <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {hubError}
            </p>
          ) : null}
          {hubLoading ? (
            <AdminLoading label="Loading hub fees…" />
          ) : (
            <div className="space-y-2 rounded-2xl border bg-card p-3 shadow-card">
              {HUB_CATALOG_SERVICES.map((service) => (
                <div
                  key={service}
                  className="flex flex-wrap items-center gap-2 border-b border-border/50 py-2 last:border-0"
                >
                  <p className="min-w-[10rem] flex-1 text-sm font-bold">{service}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">₦</span>
                    <Input
                      className="h-9 w-28 rounded-xl"
                      inputMode="numeric"
                      value={hubDrafts[service] ?? ""}
                      onChange={(e) =>
                        setHubDrafts((prev) => ({
                          ...prev,
                          [service]: e.target.value.replace(/[^0-9]/g, ""),
                        }))
                      }
                      placeholder="0"
                    />
                    <Button
                      size="sm"
                      className="h-9 rounded-xl text-xs font-bold"
                      disabled={savingService === service}
                      onClick={() => void saveHub(service)}
                    >
                      {savingService === service ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
