/**
 * Phase A+B — staff hub orders, catalog fees, notes, fulfillment/dispatch.
 * Status changes notify the customer in-app.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyCustomerHubStatus } from "@/lib/hub-documents.functions";
import { notifyStaff } from "@/lib/hub-notify.server";

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
};

const HUB_STATUSES = ["pending", "in_progress", "successful", "failed"] as const;
export type HubOrderStatus = (typeof HUB_STATUSES)[number];

export const FULFILLMENT_STATUSES = [
  "queued",
  "printing",
  "dispatched",
  "delivered",
  "cancelled",
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const PHYSICAL_SERVICES = [
  "nin_card_print",
  "nin_plastic_card",
  "plastic_card",
  "vehicle_license_sticker",
  "license_sticker",
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
      .in("service", [...PHYSICAL_SERVICES])
      .order("created_at", { ascending: true })
      .limit(150);
    if (error) throw new Error(error.message);

    const orders = ((rows ?? []) as HubOrderRow[]).filter((o) => {
      const st = String(o.status).toLowerCase();
      if (st === "failed") return false;
      const ful = String(asMeta(o.metadata)["fulfillment_status"] ?? "queued").toLowerCase();
      return ful !== "delivered" && ful !== "cancelled";
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

    const { error } = await admin
      .from("hub_orders")
      .update({
        status: data.status,
        metadata: { ...prevMeta, status_history: history },
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

    let nextStatus = row.status;
    if (data.fulfillmentStatus === "dispatched" || data.fulfillmentStatus === "printing") {
      nextStatus = "in_progress";
    }
    if (data.fulfillmentStatus === "delivered") {
      nextStatus = "successful";
    }
    if (data.fulfillmentStatus === "cancelled") {
      nextStatus = "failed";
    }

    const { error } = await admin
      .from("hub_orders")
      .update({
        status: nextStatus,
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);

    const msg =
      data.fulfillmentStatus === "dispatched"
        ? "Your package is with the dispatcher."
        : data.fulfillmentStatus === "delivered"
          ? "Your package was marked delivered."
          : data.fulfillmentStatus === "printing"
            ? "Your item is being prepared for delivery."
            : `Fulfillment: ${data.fulfillmentStatus}`;

    await notifyCustomerHubStatus({
      userId: row.user_id,
      service: row.service,
      status: nextStatus,
    });
    // Extra clear delivery line
    if (data.fulfillmentStatus === "dispatched" || data.fulfillmentStatus === "delivered") {
      const { notifyUser } = await import("@/lib/hub-notify.server");
      await notifyUser({
        userId: row.user_id,
        title: `Delivery · ${data.fulfillmentStatus}`,
        message: msg,
        type: data.fulfillmentStatus === "delivered" ? "success" : "information",
      });
    }

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
