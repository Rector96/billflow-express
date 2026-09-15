/**
 * Phase A — /admin/hub-orders
 * Staff console for CAC, NIN, TIN, documents, vehicle hub orders.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import {
  listHubOrders,
  updateHubOrderStatus,
  type HubOrderRow,
  type HubOrderStatus,
} from "@/lib/admin-hub.functions";
import { BRAND } from "@/lib/brand";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/hub-orders")({
  head: () => ({ meta: [{ title: `Hub Orders — ${BRAND.name} Admin` }] }),
  component: AdminHubOrders,
});

function slaLabel(createdAt: string): { text: string; tone: "ok" | "warn" | "bad" } {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ageMs / 60_000);
  if (mins < 60) return { text: `${mins}m`, tone: "ok" };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { text: `${hours}h`, tone: hours >= 6 ? "warn" : "ok" };
  const days = Math.floor(hours / 24);
  return { text: `${days}d`, tone: "bad" };
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        s === "successful" && "bg-emerald-500/15 text-emerald-700",
        s === "pending" && "bg-amber-500/15 text-amber-800",
        s === "in_progress" && "bg-sky-500/15 text-sky-800",
        s === "failed" && "bg-destructive/15 text-destructive",
        !["successful", "pending", "in_progress", "failed"].includes(s) &&
          "bg-muted text-muted-foreground",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function metaGet(meta: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  if (!meta) return "";
  for (const k of keys) {
    const v = meta[k];
    if (v != null && String(v).trim()) return String(v);
  }
  return "";
}

function AdminHubOrders() {
  const runList = useServerFn(listHubOrders);
  const runStatus = useServerFn(updateHubOrderStatus);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<HubOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HubOrderRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterService, setFilterService] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runList({
        data: {
          limit: 150,
          service: filterService || undefined,
          status: filterStatus || undefined,
        },
      });
      setOrders(res.orders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load hub orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [runList, filterService, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (status: HubOrderStatus) => {
    if (!selected) return;
    setBusy(true);
    try {
      await runStatus({ data: { orderId: selected.id, status } });
      toast.success(`Marked ${status.replace(/_/g, " ")}`);
      setSelected((prev) => (prev ? { ...prev, status } : null));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const detailMeta = useMemo(() => {
    const m = selected?.metadata;
    return m && typeof m === "object" ? m : null;
  }, [selected]);

  return (
    <AdminShell
      title="Hub orders"
      subtitle="CAC, NIN, TIN, documents, vehicle — fulfillment queue"
      actions={
        <button
          type="button"
          onClick={() => void load()}
          className="press flex h-10 items-center gap-2 rounded-xl border bg-card px-3 text-xs font-bold"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Refresh
        </button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={filterService}
          onChange={(e) => setFilterService(e.target.value)}
          className="h-9 rounded-xl border bg-card px-3 text-xs font-semibold"
        >
          <option value="">All services</option>
          {["cac", "tin", "documents", "nin_retrieve", "nin_slip", "nin_card_print", "vehicle_license_sticker", "vehicle_third_party_insurance", "license_sticker", "third_party_insurance"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-xl border bg-card px-3 text-xs font-semibold"
        >
          <option value="">All statuses</option>
          {"pending,in_progress,successful,failed".split(",").map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
          <span className="mt-1 block text-xs">
            Confirm you are staff (`is_staff`) and `hub_orders` exists. Apply hub migrations if needed.
          </span>
        </p>
      ) : null}

      {loading ? (
        <AdminLoading label="Loading hub orders…" />
      ) : orders.length === 0 ? (
        <AdminEmpty
          title="No hub orders yet"
          body="Paid CAC, TIN, NIN, documents, and vehicle orders appear here after checkout writes hub_orders."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Order</th>
                <th className="px-3 py-2.5 font-semibold">Service</th>
                <th className="px-3 py-2.5 font-semibold">User</th>
                <th className="px-3 py-2.5 font-semibold">Amount</th>
                <th className="px-3 py-2.5 font-semibold">Payment ref</th>
                <th className="px-3 py-2.5 font-semibold">Created</th>
                <th className="px-3 py-2.5 font-semibold">SLA</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const sla = slaLabel(o.created_at);
                return (
                  <tr
                    key={o.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    onClick={() => setSelected(o)}
                  >
                    <td className="px-3 py-2.5 font-mono text-[11px]">{o.id.slice(0, 8)}…</td>
                    <td className="px-3 py-2.5 font-semibold">{o.service}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {(o.customer_identifier || o.user_id).slice(0, 12)}
                    </td>
                    <td className="px-3 py-2.5 font-bold tabular-nums">
                      {formatNaira(Number(o.amount), false)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">
                      {(o.payment_reference || "—").slice(0, 18)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("en-NG")}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          sla.tone === "ok" && "bg-emerald-500/10 text-emerald-700",
                          sla.tone === "warn" && "bg-amber-500/15 text-amber-800",
                          sla.tone === "bad" && "bg-destructive/15 text-destructive",
                        )}
                      >
                        {sla.text}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setSelected(null)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l bg-background shadow-float">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-extrabold">Order detail</p>
                <p className="font-mono text-[10px] text-muted-foreground">{selected.id}</p>
              </div>
              <button
                type="button"
                className="grid size-9 place-items-center rounded-xl border"
                onClick={() => setSelected(null)}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={selected.status} />
              </div>
              <Row label="Service" value={selected.service} />
              <Row label="Amount" value={formatNaira(Number(selected.amount), false)} />
              <Row label="Payment ref" value={selected.payment_reference || "—"} />
              <Row label="Tracking" value={selected.tracking_reference || "—"} />
              <Row label="User id" value={selected.user_id} />
              <Row label="Customer id" value={selected.customer_identifier || "—"} />
              <Row label="Created" value={new Date(selected.created_at).toLocaleString("en-NG")} />

              <p className="pt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Metadata
              </p>
              <Row label="Plate" value={metaGet(detailMeta, "plate", "plate_number")} />
              <Row label="Make / model" value={metaGet(detailMeta, "makeModel", "make_model")} />
              <Row
                label="Shipping address"
                value={metaGet(detailMeta, "shipping_address", "shippingAddress", "address")}
              />
              <Row label="TIN" value={metaGet(detailMeta, "tin")} />
              <Row label="Taxpayer" value={metaGet(detailMeta, "taxpayerName")} />
              <pre className="max-h-40 overflow-auto rounded-xl bg-muted/40 p-3 font-mono text-[10px]">
                {JSON.stringify(detailMeta ?? {}, null, 2)}
              </pre>
            </div>
            <div className="space-y-2 border-t p-4">
              <p className="text-[11px] font-semibold text-muted-foreground">State transitions</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs"
                  disabled={busy}
                  onClick={() => void setStatus("in_progress")}
                >
                  In progress
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl text-xs"
                  disabled={busy}
                  onClick={() => void setStatus("successful")}
                >
                  Complete
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-xl text-xs"
                  disabled={busy}
                  onClick={() => void setStatus("failed")}
                >
                  Fail
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </AdminShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-xs font-semibold break-all">{value}</span>
    </div>
  );
}
