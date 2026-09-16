/**
 * /admin/hub-orders — queue + detail: status, notes, document link, dispatch.
 * Auto-refreshes every 20s so staff see new orders quickly.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addHubStaffNote,
  listHubOrders,
  updateHubFulfillment,
  updateHubOrderStatus,
  type HubOrderRow,
  type HubOrderStatus,
} from "@/lib/admin-hub.functions";
import { attachHubDocument } from "@/lib/hub-documents.functions";
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
  return { text: `${Math.floor(hours / 24)}d`, tone: "bad" };
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
  const runNote = useServerFn(addHubStaffNote);
  const runFul = useServerFn(updateHubFulfillment);
  const runAttach = useServerFn(attachHubDocument);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<HubOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HubOrderRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterService, setFilterService] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [noteText, setNoteText] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const prevCount = useRef<number | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const res = await runList({
          data: {
            limit: 150,
            service: filterService || undefined,
            status: filterStatus || undefined,
          },
        });
        const next = res.orders ?? [];
        if (prevCount.current != null && next.length > prevCount.current) {
          toast.message("New hub order in queue");
        }
        prevCount.current = next.length;
        setOrders(next);
        setSelected((prev) => {
          if (!prev) return null;
          return next.find((o) => o.id === prev.id) ?? prev;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load hub orders");
        if (!quiet) setOrders([]);
      } finally {
        setLoading(false);
      }
    },
    [runList, filterService, filterStatus],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => void load(true), 20_000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDocUrl("");
      return;
    }
    const m = selected.metadata && typeof selected.metadata === "object" ? selected.metadata : {};
    const existing =
      typeof m["document_url"] === "string"
        ? m["document_url"]
        : typeof m["certificate_url"] === "string"
          ? m["certificate_url"]
          : "";
    setDocUrl(existing);
  }, [selected?.id]);

  const setStatus = async (status: HubOrderStatus, note?: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await runStatus({ data: { orderId: selected.id, status, note } });
      toast.success(`Marked ${status.replace(/_/g, " ")} — customer notified`);
      await load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (!selected || !noteText.trim()) return;
    setBusy(true);
    try {
      await runNote({ data: { orderId: selected.id, note: noteText.trim() } });
      setNoteText("");
      toast.success("Note saved");
      await load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save note");
    } finally {
      setBusy(false);
    }
  };

  const saveDocument = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await runAttach({
        data: { orderId: selected.id, documentUrl: docUrl.trim(), markReady: true },
      });
      toast.success("Document linked — customer notified");
      await load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not attach document");
    } finally {
      setBusy(false);
    }
  };

  const detailMeta = useMemo(() => {
    const m = selected?.metadata;
    return m && typeof m === "object" ? m : null;
  }, [selected]);

  const isCac = selected?.service?.toLowerCase().includes("cac");
  const isPhysical =
    selected &&
    ["nin_card", "plastic", "license_sticker", "vehicle_license"].some(
      (x) =>
        selected.service.toLowerCase().includes(x.replace("_", "")) ||
        selected.service.toLowerCase().includes(x),
    );

  const staffNotes = Array.isArray(detailMeta?.["staff_notes"])
    ? (detailMeta!["staff_notes"] as { at?: string; text?: string; by?: string }[])
    : [];

  return (
    <AdminShell
      title="Hub orders"
      subtitle="CAC, NIN, TIN, documents, vehicle — auto-refreshes every 20s"
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
          {[
            "cac",
            "tin",
            "documents",
            "nin_retrieve",
            "nin_slip",
            "nin_card_print",
            "vehicle_license_sticker",
            "vehicle_third_party_insurance",
            "license_sticker",
            "third_party_insurance",
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
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
        </p>
      ) : null}

      {loading && orders.length === 0 ? (
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

              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                  Customer download file
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Paste an https link (Drive, storage, CDN). Customer is notified and can open Profile
                  → My documents.
                </p>
                <Input
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-2 h-10 rounded-xl text-xs"
                />
                <Button
                  size="sm"
                  className="mt-2 w-full rounded-xl text-xs"
                  disabled={busy || !docUrl.trim()}
                  onClick={() => void saveDocument()}
                >
                  Attach & mark ready
                </Button>
              </div>

              {isCac ? (
                <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-teal-800 dark:text-teal-200">
                    CAC workflow
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-muted-foreground">
                    <li>Confirm payment + docs in metadata</li>
                    <li>Mark in progress when filing starts</li>
                    <li>Attach certificate link when ready</li>
                    <li>Complete / notify customer</li>
                  </ol>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-[10px]"
                      disabled={busy}
                      onClick={() => void setStatus("in_progress", "CAC filing started")}
                    >
                      Start filing
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-xl text-[10px]"
                      disabled={busy}
                      onClick={() => void setStatus("successful", "CAC certificate ready")}
                    >
                      Certificate ready
                    </Button>
                  </div>
                </div>
              ) : null}

              <p className="pt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Metadata
              </p>
              <Row label="Plate" value={metaGet(detailMeta, "plate", "plate_number")} />
              <Row label="Make / model" value={metaGet(detailMeta, "makeModel", "make_model")} />
              <Row
                label="Shipping address"
                value={metaGet(detailMeta, "shipping_address", "shippingAddress", "address")}
              />
              <Row label="Document URL" value={metaGet(detailMeta, "document_url", "certificate_url")} />
              <Row label="TIN" value={metaGet(detailMeta, "tin")} />
              <Row label="Taxpayer" value={metaGet(detailMeta, "taxpayerName")} />
              <Row
                label="Fulfillment"
                value={metaGet(detailMeta, "fulfillment_status") || (isPhysical ? "queued" : "")}
              />

              {isPhysical ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-[10px]"
                    disabled={busy}
                    onClick={() =>
                      void runFul({
                        data: { orderId: selected.id, fulfillmentStatus: "printing" },
                      }).then(() => load(true))
                    }
                  >
                    Mark printing
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl text-[10px]"
                    disabled={busy}
                    onClick={() =>
                      void runFul({
                        data: { orderId: selected.id, fulfillmentStatus: "dispatched" },
                      }).then(() => {
                        toast.success("Customer notified — dispatched");
                        return load(true);
                      })
                    }
                  >
                    Mark dispatched
                  </Button>
                </div>
              ) : null}

              <p className="pt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Staff notes
              </p>
              <div className="max-h-32 space-y-2 overflow-y-auto">
                {staffNotes.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">No notes yet.</p>
                ) : (
                  staffNotes
                    .slice()
                    .reverse()
                    .map((n, i) => (
                      <div key={i} className="rounded-xl border bg-muted/30 px-2.5 py-2 text-[11px]">
                        <p>{n.text}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {n.at ? new Date(n.at).toLocaleString("en-NG") : ""}
                        </p>
                      </div>
                    ))
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Internal note…"
                  className="h-10 rounded-xl text-xs"
                />
                <Button size="sm" className="h-10 rounded-xl" disabled={busy} onClick={() => void saveNote()}>
                  Add
                </Button>
              </div>

              <pre className="max-h-40 overflow-auto rounded-xl bg-muted/40 p-3 font-mono text-[10px]">
                {JSON.stringify(detailMeta ?? {}, null, 2)}
              </pre>
            </div>
            <div className="space-y-2 border-t p-4">
              <p className="text-[11px] font-semibold text-muted-foreground">Order status</p>
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
      <span className="max-w-[60%] break-all text-right text-xs font-semibold">{value}</span>
    </div>
  );
}
