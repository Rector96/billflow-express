/**
 * Staff hub orders + fulfillment (manual dispatch, no courier API).
 * Lifecycle: looked_up → paid → digital_ready → queued_print → sealed → dispatched → delivered
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyCustomerHubStatus } from "@/lib/hub-documents.functions";
import {
  FULFILLMENT_STATUSES,
  type FulfillmentStatus,
  paymentStatusForFulfillment,
} from "@/lib/hub-fulfillment";
import { notifyStaff, notifyUser } from "@/lib/hub-notify.server";

export type HubOrderRow = {
  id: string;
  user_id: string;
  service: string;
  amount: number;
  status: string;
  payment_reference: string | null;
  tracking_reference: string | null;
  customer_identifier: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
  fulfillment_status?: string | null;
  tracking_note?: string | null;
  document_url?: string | null;
};

const HUB_STATUSES = ["pending", "in_progress", "successful", "failed"] as const;
export type HubOrderStatus = (typeof HUB_STATUSES)[number];

export { FULFILLMENT_STATUSES, type FulfillmentStatus };

export const PHYSICAL_SERVICES = [
  "nin_card_print",
  "nin_plastic_card",
  "plastic_card",
  "vehicle_license_sticker",
  "license_sticker",
  "cac",
] as const;

export const HUB_CATALOG_SERVICES = [
  "tin",
  "documents",
  "cac",
  "cac_courier",
  "nin_retrieve",
  "nin_slip",
  "nin_card_print",
  "nin_plastic_card",
  "nin_courier",
  "vehicle",
  "vehicle_license_sticker",
  "vehicle_third_party_insurance",
] as const;

async function assertStaff(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message || "Staff check failed");
  if (data !== true) throw new Error("Forbidden: staff only");
  return supabaseAdmin;
}

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
}

export const listHubOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number; service?: string; status?: string } | undefined) => ({
    limit: Math.min(Math.max(Number(input?.limit ?? 100), 1), 200),
    service: String(input?.service ?? "")
      .trim()
      .toLowerCase(),
    status: String(input?.status ?? "")
      .trim()
      .toLowerCase(),
  }))
  .handler(async ({ data, context }): Promise<{ orders: HubOrderRow[] }> => {
    const admin = await assertStaff(context.userId);
    let q = admin
      .from("hub_orders")
      .select(
        "id, user_id, service, amount, status, payment_reference, tracking_reference, customer_identifier, metadata, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.service) q = q.eq("service", data.service);
    if (data.status) q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { orders: (rows ?? []) as HubOrderRow[] };
  });

export const listDispatchQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ orders: HubOrderRow[] }> => {
    const admin = await assertStaff(context.userId);
    const { data: rows, error } = await admin
      .from("hub_orders")
      .select(
        "id, user_id, service, amount, status, payment_reference, tracking_reference, customer_identifier, metadata, created_at, updated_at",
      )
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);

    const orders = ((rows ?? []) as HubOrderRow[]).filter((o) => {
      const st = String(o.status).toLowerCase();
      if (st === "failed") return false;
      const meta = asMeta(o.metadata);
      const delivery = String(meta["delivery"] ?? "").toLowerCase();
      const ful = String(meta["fulfillment_status"] ?? "paid").toLowerCase();
      if (ful === "delivered" || ful === "cancelled" || ful === "digital_ready") return false;
      // Physical path: explicit deliver or known physical service
      const svc = o.service.toLowerCase();
      const physical =
        delivery === "deliver" ||
        svc.includes("card_print") ||
        svc.includes("plastic") ||
        svc.includes("sticker") ||
        svc.includes("license");
      if (!physical && delivery === "download") return false;
      if (!physical && !delivery) {
        // include cac only if shipping_address present
        if (svc.includes("cac") && meta["shipping_address"]) return true;
        return false;
      }
      return true;
    });
    return { orders };
  });

export const updateHubOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; status: string; note?: string }) => {
    const orderId = String(input?.orderId ?? "").trim();
    const status = String(input?.status ?? "")
      .trim()
      .toLowerCase();
    if (!orderId) throw new Error("Missing order id");
    if (!HUB_STATUSES.includes(status as HubOrderStatus)) {
      throw new Error("Invalid status");
    }
    return { orderId, status: status as HubOrderStatus, note: String(input?.note ?? "").trim() };
  })
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);

    const { data: existing, error: readErr } = await admin
      .from("hub_orders")
      .select("id, user_id, service, metadata, status")
      .eq("id", data.orderId)
      .limit(1);
    if (readErr) throw new Error(readErr.message);
    const row = existing?.[0] as
      | {
          id: string;
          user_id: string;
          service: string;
          metadata: Record<string, unknown> | null;
          status: string;
        }
      | undefined;
    if (!row) throw new Error("Order not found");

    const prevMeta = asMeta(row.metadata);
    const history = Array.isArray(prevMeta["status_history"])
      ? [...(prevMeta["status_history"] as unknown[])]
      : [];
    history.push({
      from: row.status,
      to: data.status,
      at: new Date().toISOString(),
      by: context.userId,
      note: data.note || null,
    });

    // Align fulfillment when payment status is completed for soft-copy style closes
    const nextMeta = { ...prevMeta, status_history: history };
    if (data.status === "successful" && !nextMeta["fulfillment_status"]) {
      nextMeta["fulfillment_status"] = "digital_ready";
    }

    const { error } = await admin
      .from("hub_orders")
      .update({
        status: data.status,
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.orderId);

    if (error) throw new Error(error.message);

    if (row.status !== data.status) {
      await notifyCustomerHubStatus({
        userId: row.user_id,
        service: row.service,
        status: data.status,
      });
      await notifyStaff({
        title: "Hub order updated",
        message: `${row.service} → ${data.status.replace(/_/g, " ")} (${data.orderId.slice(0, 8)}…)`,
        type: "information",
      });
    }

    return { ok: true as const, status: data.status };
  });

export const addHubStaffNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; note: string }) => {
    const orderId = String(input?.orderId ?? "").trim();
    const note = String(input?.note ?? "").trim();
    if (!orderId) throw new Error("Missing order id");
    if (note.length < 2) throw new Error("Note is too short");
    if (note.length > 2000) throw new Error("Note is too long");
    return { orderId, note };
  })
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);
    const { data: existing, error: readErr } = await admin
      .from("hub_orders")
      .select("id, metadata")
      .eq("id", data.orderId)
      .limit(1);
    if (readErr) throw new Error(readErr.message);
    const row = existing?.[0] as { id: string; metadata: unknown } | undefined;
    if (!row) throw new Error("Order not found");

    const prevMeta = asMeta(row.metadata);
    const notes = Array.isArray(prevMeta["staff_notes"])
      ? [...(prevMeta["staff_notes"] as unknown[])]
      : [];
    notes.push({
      at: new Date().toISOString(),
      by: context.userId,
      text: data.note,
    });

    const { error } = await admin
      .from("hub_orders")
      .update({
        metadata: { ...prevMeta, staff_notes: notes },
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateHubFulfillment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orderId: string;
      fulfillmentStatus: string;
      courierName?: string;
      courierPhone?: string;
      trackingCode?: string;
      note?: string;
    }) => {
      const orderId = String(input?.orderId ?? "").trim();
      const fulfillmentStatus = String(input?.fulfillmentStatus ?? "")
        .trim()
        .toLowerCase();
      if (!orderId) throw new Error("Missing order id");
      if (!FULFILLMENT_STATUSES.includes(fulfillmentStatus as FulfillmentStatus)) {
        throw new Error("Invalid fulfillment status");
      }
      return {
        orderId,
        fulfillmentStatus: fulfillmentStatus as FulfillmentStatus,
        courierName: String(input?.courierName ?? "").trim(),
        courierPhone: String(input?.courierPhone ?? "").trim(),
        trackingCode: String(input?.trackingCode ?? "").trim(),
        note: String(input?.note ?? "").trim(),
      };
    },
  )
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);
    const { data: existing, error: readErr } = await admin
      .from("hub_orders")
      .select("id, user_id, service, metadata, status")
      .eq("id", data.orderId)
      .limit(1);
    if (readErr) throw new Error(readErr.message);
    const row = existing?.[0] as
      | { id: string; user_id: string; service: string; metadata: unknown; status: string }
      | undefined;
    if (!row) throw new Error("Order not found");

    const prevMeta = asMeta(row.metadata);
    const history = Array.isArray(prevMeta["fulfillment_history"])
      ? [...(prevMeta["fulfillment_history"] as unknown[])]
      : [];
    history.push({
      to: data.fulfillmentStatus,
      at: new Date().toISOString(),
      by: context.userId,
      courierName: data.courierName || null,
      courierPhone: data.courierPhone || null,
      trackingCode: data.trackingCode || null,
      note: data.note || null,
    });

    const nextMeta: Record<string, unknown> = {
      ...prevMeta,
      fulfillment_status: data.fulfillmentStatus,
      fulfillment_history: history,
    };
    if (data.courierName) nextMeta["courier_name"] = data.courierName;
    if (data.courierPhone) nextMeta["courier_phone"] = data.courierPhone;
    if (data.trackingCode) nextMeta["courier_tracking"] = data.trackingCode;
    if (data.note) nextMeta["tracking_note"] = data.note;

    const nextStatus = paymentStatusForFulfillment(data.fulfillmentStatus);
    const patch: Record<string, unknown> = {
      status: nextStatus,
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    };

    // Optional columns from migration (ignored if missing via catch)
    try {
      patch["fulfillment_status"] = data.fulfillmentStatus;
      if (data.trackingCode || data.note) {
        patch["tracking_note"] = data.trackingCode || data.note;
      }
      if (data.fulfillmentStatus === "dispatched") {
        patch["dispatched_at"] = new Date().toISOString();
      }
      if (data.fulfillmentStatus === "delivered") {
        patch["delivered_at"] = new Date().toISOString();
      }
      if (data.fulfillmentStatus === "paid") {
        patch["paid_at"] = new Date().toISOString();
      }
    } catch {
      /* columns may not exist yet */
    }

    const { error } = await admin
      .from("hub_orders")
      .update(patch as never)
      .eq("id", data.orderId);
    if (error) {
      // Retry without optional columns if schema not migrated
      const { error: e2 } = await admin
        .from("hub_orders")
        .update({
          status: nextStatus,
          metadata: nextMeta,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", data.orderId);
      if (e2) throw new Error(e2.message);
    }

    const ful = data.fulfillmentStatus;
    const customerMsg =
      ful === "digital_ready"
        ? "Your digital file is ready. Open Profile → My documents."
        : ful === "queued_print"
          ? "Your physical pack is queued for printing."
          : ful === "sealed"
            ? "Your package is sealed and ready for dispatch."
            : ful === "dispatched"
              ? `Your package is on the way.${data.trackingCode ? ` Tracking: ${data.trackingCode}` : data.courierName ? ` Rider: ${data.courierName}` : ""}`
              : ful === "delivered"
                ? "Your package was marked delivered."
                : `Order progress: ${ful.replace(/_/g, " ")}`;

    await notifyUser({
      userId: row.user_id,
      title: `Order · ${ful.replace(/_/g, " ")}`,
      message: customerMsg,
      type: ful === "delivered" || ful === "digital_ready" ? "success" : "information",
    });

    await notifyStaff({
      title: "Fulfillment updated",
      message: `${row.service} → ${ful} (${data.orderId.slice(0, 8)}…)`,
      type: "information",
    });

    return { ok: true as const, fulfillmentStatus: data.fulfillmentStatus, status: nextStatus };
  });

export const listHubCatalogFees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertStaff(context.userId);
    const { data, error } = await admin
      .from("pricing_rules")
      .select("id, service, markup_type, markup_value, is_active, priority")
      .in("service", [...HUB_CATALOG_SERVICES])
      .order("service", { ascending: true });
    if (error) throw new Error(error.message);
    return { rules: data ?? [] };
  });

export const updateHubCatalogFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { service: string; markupValue: number }) => {
    const service = String(input?.service ?? "")
      .trim()
      .toLowerCase();
    if (!(HUB_CATALOG_SERVICES as readonly string[]).includes(service)) {
      throw new Error("Unknown hub service");
    }
    const markupValue = Math.round(Number(input?.markupValue));
    if (!Number.isFinite(markupValue) || markupValue < 0) throw new Error("Invalid fee");
    return { service, markupValue };
  })
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);

    const { data: rows } = await admin
      .from("pricing_rules")
      .select("id")
      .eq("service", data.service)
      .eq("is_active", true)
      .limit(1);

    if (rows?.[0]?.id) {
      const { error } = await admin
        .from("pricing_rules")
        .update({
          markup_type: "selling_price",
          markup_value: data.markupValue,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", rows[0].id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("pricing_rules").insert({
        service: data.service,
        provider: null,
        product_code: null,
        markup_type: "selling_price",
        markup_value: data.markupValue,
        is_active: true,
        priority: 100,
      } as never);
      if (error) throw new Error(error.message);
    }

    return { ok: true as const, service: data.service, markupValue: data.markupValue };
  });
