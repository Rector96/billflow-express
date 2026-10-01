/**
 * Staff hub orders — bank-grade detail, agent desk, care call, fulfillment.
 * Document attach → customer notified to login & download (My documents).
 * Resend optional (off until domain verified).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyCustomerHubStatus } from "@/lib/hub-documents.functions";
import { sendHubLifecycleEmail } from "@/lib/hub-email.server";
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
};

export type HubCustomerProfile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

export type HubOrderDetail = HubOrderRow & {
  profile: HubCustomerProfile | null;
};

const HUB_STATUSES = ["pending", "in_progress", "successful", "failed"] as const;
export type HubOrderStatus = (typeof HUB_STATUSES)[number];

export { FULFILLMENT_STATUSES, type FulfillmentStatus };

export const CARE_CALL_STATUSES = [
  "pending",
  "called",
  "confirmed",
  "no_answer",
  "skipped",
] as const;
export type CareCallStatus = (typeof CARE_CALL_STATUSES)[number];

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

/** Full order + profile for bank-grade side panel */
export const getHubOrderDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => {
    const orderId = String(input?.orderId ?? "").trim();
    if (!orderId) throw new Error("Missing order id");
    return { orderId };
  })
  .handler(async ({ data, context }): Promise<{ order: HubOrderDetail }> => {
    const admin = await assertStaff(context.userId);
    const { data: rows, error } = await admin
      .from("hub_orders")
      .select(
        "id, user_id, service, amount, status, payment_reference, tracking_reference, customer_identifier, metadata, created_at, updated_at",
      )
      .eq("id", data.orderId)
      .limit(1);
    if (error) throw new Error(error.message);
    const row = rows?.[0] as HubOrderRow | undefined;
    if (!row) throw new Error("Order not found");

    let profile: HubCustomerProfile | null = null;
    try {
      const { data: p } = await admin
        .from("profiles")
        .select("full_name, email, phone")
        .eq("user_id", row.user_id)
        .maybeSingle();
      if (p) {
        profile = {
          full_name: (p as { full_name?: string | null }).full_name ?? null,
          email: (p as { email?: string | null }).email ?? null,
          phone: (p as { phone?: string | null }).phone ?? null,
        };
      }
    } catch {
      /* profiles optional */
    }

    // Fallback email from auth if profile empty
    if (!profile?.email) {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(row.user_id);
        const email = authUser.user?.email ?? null;
        profile = {
          full_name: profile?.full_name ?? null,
          email: email ?? profile?.email ?? null,
          phone: profile?.phone ?? null,
        };
      } catch {
        /* ignore */
      }
    }

    return { order: { ...row, profile } };
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
      const svc = o.service.toLowerCase();
      const physical =
        delivery === "deliver" ||
        svc.includes("card_print") ||
        svc.includes("plastic") ||
        svc.includes("sticker") ||
        svc.includes("license");
      if (!physical && delivery === "download") return false;
      if (!physical && !delivery) {
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
      .select("id, user_id, service, metadata, status, tracking_reference, amount")
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
          tracking_reference: string | null;
          amount: number;
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

    const nextMeta = { ...prevMeta, status_history: history };
    if (data.status === "successful") {
      nextMeta["fulfillment_status"] = nextMeta["fulfillment_status"] || "digital_ready";
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
      if (data.status === "successful") {
        void sendHubLifecycleEmail({
          userId: row.user_id,
          event: "digital_ready",
          service: row.service,
          trackingReference: row.tracking_reference,
          amount: row.amount,
        });
      }
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

/** Assign order to an agent desk (name label is enough for launch). */
export const assignHubAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; agentLabel: string; agentDesk?: string }) => {
    const orderId = String(input?.orderId ?? "").trim();
    const agentLabel = String(input?.agentLabel ?? "").trim();
    if (!orderId) throw new Error("Missing order id");
    if (agentLabel.length < 2) throw new Error("Enter agent name or desk");
    return {
      orderId,
      agentLabel: agentLabel.slice(0, 120),
      agentDesk: String(input?.agentDesk ?? "")
        .trim()
        .slice(0, 80),
    };
  })
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);
    const { data: existing, error: readErr } = await admin
      .from("hub_orders")
      .select("id, user_id, service, metadata")
      .eq("id", data.orderId)
      .limit(1);
    if (readErr) throw new Error(readErr.message);
    const row = existing?.[0] as
      { id: string; user_id: string; service: string; metadata: unknown } | undefined;
    if (!row) throw new Error("Order not found");

    const prevMeta = asMeta(row.metadata);
    const nextMeta = {
      ...prevMeta,
      assigned_agent: data.agentLabel,
      assigned_desk: data.agentDesk || prevMeta["assigned_desk"] || null,
      assigned_at: new Date().toISOString(),
      assigned_by: context.userId,
    };

    const { error } = await admin
      .from("hub_orders")
      .update({
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);

    await notifyStaff({
      title: "Order assigned",
      message: `${row.service} → ${data.agentLabel} (${data.orderId.slice(0, 8)}…)`,
      type: "information",
    });

    return { ok: true as const };
  });

/** Care team call log before dispatch / after digital ready. */
export const updateHubCareCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; careStatus: string; note?: string }) => {
    const orderId = String(input?.orderId ?? "").trim();
    const careStatus = String(input?.careStatus ?? "")
      .trim()
      .toLowerCase();
    if (!orderId) throw new Error("Missing order id");
    if (!CARE_CALL_STATUSES.includes(careStatus as CareCallStatus)) {
      throw new Error("Invalid care status");
    }
    return {
      orderId,
      careStatus: careStatus as CareCallStatus,
      note: String(input?.note ?? "")
        .trim()
        .slice(0, 1000),
    };
  })
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);
    const { data: existing, error: readErr } = await admin
      .from("hub_orders")
      .select("id, user_id, service, metadata")
      .eq("id", data.orderId)
      .limit(1);
    if (readErr) throw new Error(readErr.message);
    const row = existing?.[0] as
      { id: string; user_id: string; service: string; metadata: unknown } | undefined;
    if (!row) throw new Error("Order not found");

    const prevMeta = asMeta(row.metadata);
    const careLog = Array.isArray(prevMeta["care_call_log"])
      ? [...(prevMeta["care_call_log"] as unknown[])]
      : [];
    careLog.push({
      status: data.careStatus,
      note: data.note || null,
      at: new Date().toISOString(),
      by: context.userId,
    });

    const nextMeta = {
      ...prevMeta,
      care_call_status: data.careStatus,
      care_call_note: data.note || prevMeta["care_call_note"] || null,
      care_call_at: new Date().toISOString(),
      care_call_log: careLog,
    };

    const { error } = await admin
      .from("hub_orders")
      .update({
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);

    if (data.careStatus === "confirmed") {
      await notifyUser({
        userId: row.user_id,
        title: "We’re preparing your order",
        message:
          "Our team confirmed your details. Watch your notifications for download or delivery updates.",
        type: "information",
      });
    }

    return { ok: true as const, careStatus: data.careStatus };
  });

/** Ping customer: login and download from Profile → My documents */
export const notifyCustomerToDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => {
    const orderId = String(input?.orderId ?? "").trim();
    if (!orderId) throw new Error("Missing order id");
    return { orderId };
  })
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);
    const { data: existing, error: readErr } = await admin
      .from("hub_orders")
      .select("id, user_id, service, tracking_reference, amount, metadata")
      .eq("id", data.orderId)
      .limit(1);
    if (readErr) throw new Error(readErr.message);
    const row = existing?.[0] as
      | {
          id: string;
          user_id: string;
          service: string;
          tracking_reference: string | null;
          amount: number;
          metadata: unknown;
        }
      | undefined;
    if (!row) throw new Error("Order not found");

    const meta = asMeta(row.metadata);
    const hasDoc =
      typeof meta["document_url"] === "string" || typeof meta["certificate_url"] === "string";
    if (!hasDoc) throw new Error("Attach a document link first");

    await notifyUser({
      userId: row.user_id,
      title: "Document ready — log in to download",
      message: `Your ${row.service.replace(/_/g, " ")} file is ready. Open Profile → My documents to download.`,
      type: "success",
    });

    void sendHubLifecycleEmail({
      userId: row.user_id,
      event: "digital_ready",
      service: row.service,
      trackingReference: row.tracking_reference,
      amount: row.amount,
    });

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
      .select("id, user_id, service, metadata, status, tracking_reference, amount")
      .eq("id", data.orderId)
      .limit(1);
    if (readErr) throw new Error(readErr.message);
    const row = existing?.[0] as
      | {
          id: string;
          user_id: string;
          service: string;
          metadata: unknown;
          status: string;
          tracking_reference: string | null;
          amount: number;
        }
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

    const { error } = await admin
      .from("hub_orders")
      .update(patch as never)
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);

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

    if (ful === "paid" || ful === "digital_ready" || ful === "dispatched" || ful === "delivered") {
      void sendHubLifecycleEmail({
        userId: row.user_id,
        event: ful,
        service: row.service,
        trackingReference: row.tracking_reference,
        amount: row.amount,
        trackingNote: data.trackingCode || data.note || null,
        courierName: data.courierName || null,
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
