/**
 * Physical dispatch queue — manual rider/waybill (no courier API).
 * Lifecycle: queued_print → sealed → dispatched → delivered
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listDispatchQueue,
  updateHubFulfillment,
  type FulfillmentStatus,
  type HubOrderRow,
} from "@/lib/admin-hub.functions";
import { FULFILLMENT_LABELS } from "@/lib/hub-fulfillment";
import { BRAND } from "@/lib/brand";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/dispatch")({
  head: () => ({ meta: [{ title: `Dispatch — ${BRAND.name} Admin` }] }),
  component: AdminDispatch,
});

function metaStr(meta: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!meta) return "";
  for (const k of keys) {
    const v = meta[k];
    if (v != null && String(v).trim()) return String(v);
  }
  return "";
}

function AdminDispatch() {
  const runList = useServerFn(listDispatchQueue);
  const runFul = useServerFn(updateHubFulfillment);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<HubOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<HubOrderRow | null>(null);
  const [courierName, setCourierName] = useState("");
  const [courierPhone, setCourierPhone] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runList();
      setOrders(res.orders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dispatch queue");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [runList]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async (status: FulfillmentStatus) => {
    if (!active) return;
    if (status === "dispatched" && !courierName.trim() && !trackingCode.trim()) {
      toast.error("Enter rider name or tracking / waybill before dispatch.");
      return;
    }
    setBusy(true);
    try {
      await runFul({
        data: {
          orderId: active.id,
          fulfillmentStatus: status,
          courierName,
          courierPhone,
          trackingCode,
        },
      });
      toast.success(`Marked ${FULFILLMENT_LABELS[status] ?? status} — customer notified`);
      setActive(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell
      title="Dispatch"
      subtitle="Physical packs — print → seal → hand to rider (manual tracking)"
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
      <p className="mb-4 text-xs text-muted-foreground">
        No courier API. Staff print, pack, give to a local rider, type name/phone or waybill, then
        Mark dispatched. Customer gets an in-app alert (email later).
      </p>

      {error ? (
        <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <AdminLoading label="Loading dispatch queue…" />
      ) : orders.length === 0 ? (
        <AdminEmpty
          title="Nothing to dispatch"
          body="Physical hub orders (deliver / NIN card / sticker / CAC with address) appear here."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const meta = (o.metadata && typeof o.metadata === "object" ? o.metadata : {}) as Record<
              string,
              unknown
            >;
            const address = metaStr(meta, "shipping_address", "shippingAddress", "address");
            const ful = metaStr(meta, "fulfillment_status") || "paid";
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setActive(o);
                  setCourierName(metaStr(meta, "courier_name"));
                  setCourierPhone(metaStr(meta, "courier_phone"));
                  setTrackingCode(metaStr(meta, "courier_tracking"));
                }}
                className="flex w-full flex-col gap-1 rounded-2xl border bg-card p-4 text-left shadow-card hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold">{o.service}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {o.tracking_reference || o.id.slice(0, 13)}
                    </p>
                  </div>
                  <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-800 uppercase">
                    {ful.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {address || "No shipping address — contact customer"}
                </p>
                <p className="text-xs font-bold tabular-nums">
                  {formatNaira(Number(o.amount), false)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {active ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setActive(null)}
          />
          <div className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border bg-background p-4 shadow-float sm:rounded-3xl">
            <div className="mb-3 flex items-center gap-2">
              <Truck className="size-5 text-primary" />
              <p className="text-sm font-extrabold">Fulfillment</p>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">{active.id}</p>
            <p className="mt-2 text-sm font-bold">{active.service}</p>
            {(() => {
              const meta = (
                active.metadata && typeof active.metadata === "object" ? active.metadata : {}
              ) as Record<string, unknown>;
              return (
                <div className="mt-3 space-y-2 rounded-2xl border bg-card p-3 text-xs">
                  <p>
                    <span className="text-muted-foreground">Address · </span>
                    {metaStr(meta, "shipping_address", "shippingAddress", "address") || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Plate · </span>
                    {metaStr(meta, "plate", "plate_number") || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Phone / id · </span>
                    {active.customer_identifier || "—"}
                  </p>
                </div>
              );
            })()}

            <div className="mt-4 space-y-2">
              <div className="space-y-1">
                <Label>Rider / courier name</Label>
                <Input
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  className="h-10 rounded-xl"
                  placeholder="e.g. Tunde bike"
                />
              </div>
              <div className="space-y-1">
                <Label>Rider phone</Label>
                <Input
                  value={courierPhone}
                  onChange={(e) => setCourierPhone(e.target.value)}
                  className="h-10 rounded-xl"
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1">
                <Label>Waybill / tracking note</Label>
                <Input
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  className="h-10 rounded-xl"
                  placeholder="Optional code"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="rounded-xl text-xs"
                disabled={busy}
                onClick={() => void apply("queued_print")}
              >
                Queue print
              </Button>
              <Button
                variant="outline"
                className="rounded-xl text-xs"
                disabled={busy}
                onClick={() => void apply("sealed")}
              >
                Sealed / packed
              </Button>
              <Button
                className="rounded-xl text-xs"
                disabled={busy}
                onClick={() => void apply("dispatched")}
              >
                Dispatched
              </Button>
              <Button
                className="rounded-xl text-xs"
                disabled={busy}
                onClick={() => void apply("delivered")}
              >
                Delivered
              </Button>
              <Button
                variant="destructive"
                className="col-span-2 rounded-xl text-xs"
                disabled={busy}
                onClick={() => void apply("cancelled")}
              >
                Cancel
              </Button>
            </div>
            <Button
              variant="ghost"
              className="mt-2 w-full rounded-xl"
              onClick={() => setActive(null)}
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
