/**
 * /admin/hub-orders — bank-grade queue + full customer/dispatch detail.
 * Attach certificate → customer downloads from Profile → My documents.
 * Agent assign + care call before dispatch.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, X, Phone, User, MapPin, FileText, Bell } from "lucide-react";
import { toast } from "sonner";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addHubStaffNote,
  assignHubAgent,
  getHubOrderDetail,
  listHubOrders,
  notifyCustomerToDownload,
  updateHubCareCall,
  updateHubFulfillment,
  updateHubOrderStatus,
  type HubOrderDetail,
  type HubOrderRow,
  type HubOrderStatus,
} from "@/lib/admin-hub.functions";
import { attachHubDocument } from "@/lib/hub-documents.functions";
import { FULFILLMENT_LABELS, type FulfillmentStatus } from "@/lib/hub-fulfillment";
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-soft">
      <p className="mb-2.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") {
    return (
      <div className="flex justify-between gap-3 border-b border-border/40 py-1.5 text-xs last:border-0">
        <span className="shrink-0 text-muted-foreground">{label}</span>
        <span className="text-right text-muted-foreground/70">—</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 py-1.5 text-xs last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="max-w-[60%] break-words text-right font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

function AdminHubOrders() {
  const runList = useServerFn(listHubOrders);
  const runDetail = useServerFn(getHubOrderDetail);
  const runStatus = useServerFn(updateHubOrderStatus);
  const runNote = useServerFn(addHubStaffNote);
  const runFul = useServerFn(updateHubFulfillment);
  const runAttach = useServerFn(attachHubDocument);
  const runAgent = useServerFn(assignHubAgent);
  const runCare = useServerFn(updateHubCareCall);
  const runNotifyDl = useServerFn(notifyCustomerToDownload);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<HubOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<HubOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filterService, setFilterService] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [noteText, setNoteText] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentDesk, setAgentDesk] = useState("nin");
  const [careNote, setCareNote] = useState("");
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

  const openDetail = async (o: HubOrderRow) => {
    setDetailLoading(true);
    setDetail(null);
    setNoteText("");
    setCareNote("");
    try {
      const res = await runDetail({ data: { orderId: o.id } });
      const d = res.order;
      setDetail(d);
      const m = d.metadata && typeof d.metadata === "object" ? d.metadata : {};
      const existing =
        typeof m["document_url"] === "string"
          ? m["document_url"]
          : typeof m["certificate_url"] === "string"
            ? m["certificate_url"]
            : "";
      setDocUrl(existing);
      setAgentName(typeof m["assigned_agent"] === "string" ? m["assigned_agent"] : "");
      setAgentDesk(
        typeof m["assigned_desk"] === "string"
          ? String(m["assigned_desk"])
          : d.service.toLowerCase().includes("vehicle")
            ? "vehicle"
            : d.service.toLowerCase().includes("cac")
              ? "cac"
              : "nin",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load detail");
      setDetail({ ...o, profile: null });
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detail) return;
    await openDetail(detail);
    await load(true);
  };

  const meta = useMemo(() => {
    const m = detail?.metadata;
    return m && typeof m === "object" ? m : null;
  }, [detail]);

  const setStatus = async (status: HubOrderStatus, note?: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      await runStatus({ data: { orderId: detail.id, status, note } });
      toast.success(`Marked ${status.replace(/_/g, " ")}`);
      await refreshDetail();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (!detail || !noteText.trim()) return;
    setBusy(true);
    try {
      await runNote({ data: { orderId: detail.id, note: noteText.trim() } });
      setNoteText("");
      toast.success("Note saved");
      await refreshDetail();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save note");
    } finally {
      setBusy(false);
    }
  };

  const saveDocument = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await runAttach({
        data: { orderId: detail.id, documentUrl: docUrl.trim(), markReady: true },
      });
      toast.success("Document attached — customer can download from My documents");
      await refreshDetail();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not attach document");
    } finally {
      setBusy(false);
    }
  };

  const pingDownload = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await runNotifyDl({ data: { orderId: detail.id } });
      toast.success("Customer notified — log in to download");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Notify failed");
    } finally {
      setBusy(false);
    }
  };

  const saveAgent = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await runAgent({
        data: { orderId: detail.id, agentLabel: agentName.trim(), agentDesk },
      });
      toast.success("Agent assigned");
      await refreshDetail();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  };

  const setCare = async (careStatus: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      await runCare({
        data: { orderId: detail.id, careStatus, note: careNote.trim() },
      });
      toast.success(`Care · ${careStatus.replace(/_/g, " ")}`);
      setCareNote("");
      await refreshDetail();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Care update failed");
    } finally {
      setBusy(false);
    }
  };

  const setFul = async (fulfillmentStatus: FulfillmentStatus) => {
    if (!detail) return;
    setBusy(true);
    try {
      await runFul({ data: { orderId: detail.id, fulfillmentStatus } });
      toast.success(FULFILLMENT_LABELS[fulfillmentStatus] ?? fulfillmentStatus);
      await refreshDetail();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fulfillment update failed");
    } finally {
      setBusy(false);
    }
  };

  const staffNotes = Array.isArray(meta?.["staff_notes"])
    ? (meta!["staff_notes"] as { at?: string; text?: string }[])
    : [];

  const delivery = metaGet(meta, "delivery") || "download";
  const ful = metaGet(meta, "fulfillment_status") || "paid";
  const phone = detail?.profile?.phone || metaGet(meta, "owner_phone", "phone") || "";
  const email = detail?.profile?.email || metaGet(meta, "owner_email", "email") || "";
  const displayName =
    detail?.profile?.full_name ||
    metaGet(meta, "owner_name", "preferred_name", "taxpayerName") ||
    "Customer";

  return (
    <AdminShell
      title="Hub orders"
      subtitle="Full customer profile · agent · care call · documents"
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
          body="CAC, NIN, TIN, documents and vehicle orders appear here after checkout."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Ref</th>
                <th className="px-3 py-2.5 font-semibold">Service</th>
                <th className="px-3 py-2.5 font-semibold">Customer id</th>
                <th className="px-3 py-2.5 font-semibold">Amount</th>
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
                    onClick={() => void openDetail(o)}
                  >
                    <td className="px-3 py-2.5 font-mono text-[11px]">
                      {o.tracking_reference || `${o.id.slice(0, 8)}…`}
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{o.service}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {(o.customer_identifier || o.user_id).slice(0, 14)}
                    </td>
                    <td className="px-3 py-2.5 font-bold tabular-nums">
                      {formatNaira(Number(o.amount), false)}
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

      {detail || detailLoading ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setDetail(null)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l bg-background shadow-float">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-extrabold">Order control</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {detail?.tracking_reference || detail?.id || "…"}
                </p>
              </div>
              <button
                type="button"
                className="grid size-9 place-items-center rounded-xl border"
                onClick={() => setDetail(null)}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {detailLoading || !detail ? (
                <p className="py-10 text-center text-xs text-muted-foreground">Loading detail…</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={detail.status} />
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">
                      {ful.replace(/_/g, " ")}
                    </span>
                  </div>

                  <Section title="Customer">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-primary">
                        <User className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold">{displayName}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {detail.user_id.slice(0, 18)}…
                        </p>
                      </div>
                    </div>
                    <Field label="Phone" value={phone || "—"} />
                    <Field label="Email" value={email || "—"} />
                    <Field label="ID / NIN / plate" value={detail.customer_identifier || "—"} />
                    {phone ? (
                      <a
                        href={`tel:${phone.replace(/\s/g, "")}`}
                        className="mt-2 flex h-9 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 text-xs font-bold text-primary"
                      >
                        <Phone className="size-3.5" /> Call customer
                      </a>
                    ) : null}
                  </Section>

                  <Section title="Order">
                    <Field label="Service" value={detail.service} />
                    <Field label="Amount" value={formatNaira(Number(detail.amount), false)} />
                    <Field label="Payment ref" value={detail.payment_reference || "—"} />
                    <Field label="Tracking" value={detail.tracking_reference || "—"} />
                    <Field label="Delivery" value={delivery} />
                    <Field
                      label="Created"
                      value={new Date(detail.created_at).toLocaleString("en-NG")}
                    />
                  </Section>

                  <Section title="Application / shipping">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                      <MapPin className="size-3" /> Address & form data
                    </div>
                    <Field label="Business name" value={metaGet(meta, "preferred_name")} />
                    <Field label="Owner" value={metaGet(meta, "owner_name")} />
                    <Field label="NIN" value={metaGet(meta, "nin")} />
                    <Field label="Nature" value={metaGet(meta, "nature")} />
                    <Field label="Business address" value={metaGet(meta, "business_address")} />
                    <Field
                      label="Shipping address"
                      value={metaGet(meta, "shipping_address", "shippingAddress", "address")}
                    />
                    <Field label="Plate" value={metaGet(meta, "plate", "plate_number")} />
                    <Field label="Make / model" value={metaGet(meta, "makeModel", "make_model")} />
                    <Field label="TIN" value={metaGet(meta, "tin")} />
                    <Field label="Taxpayer" value={metaGet(meta, "taxpayerName")} />
                  </Section>

                  <Section title="Agent desk">
                    <select
                      value={agentDesk}
                      onChange={(e) => setAgentDesk(e.target.value)}
                      className="mb-2 h-9 w-full rounded-xl border bg-background px-3 text-xs font-semibold"
                    >
                      <option value="nin">NIN desk</option>
                      <option value="vehicle">Vehicle desk</option>
                      <option value="cac">CAC / docs desk</option>
                      <option value="general">General</option>
                    </select>
                    <Input
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Agent name"
                      className="h-9 rounded-xl text-xs"
                    />
                    <Field
                      label="Currently assigned"
                      value={metaGet(meta, "assigned_agent") || "—"}
                    />
                    <Button
                      size="sm"
                      className="mt-2 w-full rounded-xl text-xs"
                      disabled={busy || agentName.trim().length < 2}
                      onClick={() => void saveAgent()}
                    >
                      Assign agent
                    </Button>
                  </Section>

                  <Section title="Care call">
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Call to confirm address / name, then mark confirmed before dispatch.
                    </p>
                    <Field
                      label="Care status"
                      value={metaGet(meta, "care_call_status") || "pending"}
                    />
                    <Input
                      value={careNote}
                      onChange={(e) => setCareNote(e.target.value)}
                      placeholder="Call notes…"
                      className="mb-2 h-9 rounded-xl text-xs"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["called", "confirmed", "no_answer", "skipped"] as const).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-[10px]"
                          disabled={busy}
                          onClick={() => void setCare(s)}
                        >
                          {s.replace(/_/g, " ")}
                        </Button>
                      ))}
                    </div>
                  </Section>

                  <Section title="Document for customer">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                      <FileText className="size-3" /> Paste https link (Drive / storage)
                    </div>
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      When CAC / NIN file is ready, attach it. Customer opens Profile → My
                      documents.
                    </p>
                    <Input
                      value={docUrl}
                      onChange={(e) => setDocUrl(e.target.value)}
                      placeholder="https://…"
                      className="h-9 rounded-xl text-xs"
                    />
                    <Button
                      size="sm"
                      className="mt-2 w-full rounded-xl text-xs"
                      disabled={busy || !docUrl.trim()}
                      onClick={() => void saveDocument()}
                    >
                      Attach & mark ready
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1.5 w-full rounded-xl text-xs"
                      disabled={busy}
                      onClick={() => void pingDownload()}
                    >
                      <Bell className="mr-1.5 size-3.5" />
                      Notify: log in & download
                    </Button>
                    <Field
                      label="Linked file"
                      value={metaGet(meta, "document_url", "certificate_url") || "—"}
                    />
                  </Section>

                  <Section title="Workflow">
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-[10px]"
                        disabled={busy}
                        onClick={() => void setStatus("in_progress", "Processing started")}
                      >
                        In progress
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl text-[10px]"
                        disabled={busy}
                        onClick={() => void setStatus("successful", "Ready for customer")}
                      >
                        Mark successful
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-[10px]"
                        disabled={busy}
                        onClick={() => void setFul("queued_print")}
                      >
                        Queue print
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-[10px]"
                        disabled={busy}
                        onClick={() => void setFul("sealed")}
                      >
                        Sealed
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl text-[10px]"
                        disabled={busy}
                        onClick={() => void setFul("dispatched")}
                      >
                        Dispatched
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl text-[10px]"
                        disabled={busy}
                        onClick={() => void setFul("delivered")}
                      >
                        Delivered
                      </Button>
                    </div>
                  </Section>

                  <Section title="Staff notes">
                    <div className="mb-2 max-h-28 space-y-1.5 overflow-y-auto">
                      {staffNotes.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">No notes yet</p>
                      ) : (
                        staffNotes
                          .slice()
                          .reverse()
                          .map((n, i) => (
                            <div key={i} className="rounded-lg bg-muted/50 px-2 py-1.5 text-[11px]">
                              <p className="font-medium">{n.text}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {n.at ? new Date(n.at).toLocaleString("en-NG") : ""}
                              </p>
                            </div>
                          ))
                      )}
                    </div>
                    <Input
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add internal note…"
                      className="h-9 rounded-xl text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full rounded-xl text-xs"
                      disabled={busy || noteText.trim().length < 2}
                      onClick={() => void saveNote()}
                    >
                      Save note
                    </Button>
                  </Section>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </AdminShell>
  );
}
