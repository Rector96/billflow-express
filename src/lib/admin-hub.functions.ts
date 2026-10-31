/**
 * Staff hub orders — bank-grade detail, agent desk, care call, fulfillment.
 * Document attach → customer notified to login & download (My documents).
 * Resend optional (off until domain verified).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyCustomerHubStatus } from "@/lib/hub-documents.functions";
import { processHubEmailOutbox, sendHubLifecycleEmail } from "@/lib/hub-email.server";
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
  applicationFiles?: Record<string, string>;
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

    const applicationFiles: Record<string, string> = {};
    if (row.service === "cac") {
      const meta = asMeta(row.metadata);
      const files = asMeta(meta["application_files"]);
      const bucket = admin.storage.from("cac-applications");
      const expectedFiles = {
        idDocument: "id-document",
        passportPhoto: "passport-photo",
        signature: "signature.png",
      } as const;

      // Only sign the three canonical CAC evidence objects. Metadata is
      // database content, not permission to expose arbitrary user files.
      for (const [key, filename] of Object.entries(expectedFiles)) {
        const path = files[key];
        if (typeof path !== "string") continue;
        const match = path.match(
          /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(id-document|passport-photo|signature\.png)$/i,
        );
        if (!match || match[2] !== filename) continue;
        const canonicalPath = `${row.user_id}/${match[1]}/${filename}`;
        if (path !== canonicalPath) continue;

        const { data: signed, error: signedError } = await bucket.createSignedUrl(
          canonicalPath,
          300,
        );
        if (signedError) {
          console.warn("[hub-admin] CAC evidence signing failed", {
            orderId: row.id,
            file: key,
          });
          continue;
        }
        if (signed?.signedUrl) applicationFiles[key] = signed.signedUrl;
      }
    }
    return { order: { ...row, profile, applicationFiles } };
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

    const statusChanged = row.status !== data.status;
    const currentMeta = asMeta(row.metadata);
    if (
      data.status === "successful" &&
      row.service === "cac" &&
      typeof currentMeta["certificate_storage_path"] !== "string" &&
      currentMeta["certificate_delivery_method"] !== "manual_email"
    ) {
      throw new Error(
        "Upload the completed CAC certificate or record its manual email delivery before marking this order successful.",
      );
    }
    const eventKey = statusChanged
      ? `hub-order:${data.orderId}:status:${data.status}:${Date.now()}`
      : typeof currentMeta["status_event_key"] === "string"
        ? currentMeta["status_event_key"]
        : `hub-order:${data.orderId}:status:${data.status}:legacy`;

    if (statusChanged) {
      const prevMeta = currentMeta;
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

      const nextMeta = {
        ...prevMeta,
        status_history: history,
        status_event_key: eventKey,
      };
      if (data.status === "successful" && row.service !== "cac") {
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
    }

    // Attempt these on every request, not only on the transition. If one
    // insert failed after the status was saved, staff can retry the same
    // status and the unique event keys recover only the missing notice.
    const [customerNotice, staffNotice] = await Promise.all([
      notifyCustomerHubStatus({
        userId: row.user_id,
        service: row.service,
        status: data.status,
        eventKey: `${eventKey}:customer:${row.user_id}`,
      }),
      notifyStaff({
        title: "Hub order updated",
        message: `${row.service} → ${data.status.replace(/_/g, " ")} (${data.orderId.slice(0, 8)}…)`,
        type: "information",
        eventKey: `${eventKey}:staff`,
      }),
    ]);

    if (!customerNotice.ok || !staffNotice.ok) {
      throw new Error(
        `Order status notification failed: ${[
          !customerNotice.ok ? customerNotice.error : null,
          !staffNotice.ok ? staffNotice.error : null,
        ]
          .filter(Boolean)
          .join("; ")}`,
      );
    }

    if (statusChanged && data.status === "successful") {
      void sendHubLifecycleEmail({
        userId: row.user_id,
        event: "digital_ready",
        eventKey: `hub-order:${data.orderId}:digital_ready:email`,
        service: row.service,
        trackingReference: row.tracking_reference,
        amount: row.amount,
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
      typeof meta["certificate_storage_path"] === "string" ||
      typeof meta["document_url"] === "string" ||
      typeof meta["certificate_url"] === "string";
    if (!hasDoc) throw new Error("Attach a document first");

    await notifyUser({
      userId: row.user_id,
      title: "Document ready — log in to download",
      message: `Your ${row.service.replace(/_/g, " ")} file is ready. Open Profile → My documents to download.`,
      type: "success",
    });

    void sendHubLifecycleEmail({
      userId: row.user_id,
      event: "digital_ready",
      eventKey: `hub-order:${data.orderId}:digital_ready:email`,
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
    if (
      data.fulfillmentStatus === "digital_ready" &&
      row.service === "cac" &&
      typeof prevMeta["certificate_storage_path"] !== "string" &&
      prevMeta["certificate_delivery_method"] !== "manual_email"
    ) {
      throw new Error(
        "Upload the completed CAC certificate or record its manual email delivery before marking it ready.",
      );
    }
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
        eventKey: `hub-order:${data.orderId}:fulfillment:${ful}:email`,
        service: row.service,
        trackingReference: row.tracking_reference,
        amount: row.amount,
        trackingNote: data.trackingCode || data.note || null,
        courierName: data.courierName || null,
      });
    }

    return { ok: true as const, fulfillmentStatus: data.fulfillmentStatus, status: nextStatus };
  });

/** Staff-triggered retry for queued Hub lifecycle emails. */
export const retryHubLifecycleEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number } | undefined) => ({
    limit: Math.min(Math.max(Math.trunc(Number(input?.limit ?? 20)), 1), 100),
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);
    const { error } = await admin
      .from("hub_email_outbox")
      .update({
        status: "pending",
        attempts: 0,
        next_attempt_at: new Date().toISOString(),
        locked_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      } as never)
      .in("status", ["pending", "failed"]);
    if (error) throw new Error(error.message);
    return processHubEmailOutbox(data.limit);
  });

/** Staff-only, PII-minimised email outbox overview. */
export const getHubEmailOutboxSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertStaff(context.userId);
    const [pending, processing, sent, failed, recent] = await Promise.all([
      admin
        .from("hub_email_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("hub_email_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "processing"),
      admin
        .from("hub_email_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent"),
      admin
        .from("hub_email_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      admin
        .from("hub_email_outbox")
        .select("id,event,status,attempts,created_at,sent_at,last_error")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    for (const result of [pending, processing, sent, failed, recent]) {
      if (result.error) throw new Error(result.error.message);
    }
    return {
      counts: {
        pending: pending.count ?? 0,
        processing: processing.count ?? 0,
        sent: sent.count ?? 0,
        failed: failed.count ?? 0,
      },
      recent: (recent.data ?? []).map((row) => ({
        id: row.id,
        event: row.event,
        status: row.status,
        attempts: row.attempts,
        createdAt: row.created_at,
        sentAt: row.sent_at,
        lastError: row.last_error ? String(row.last_error).slice(0, 180) : null,
      })),
    };
  });

/** Staff-only recheck. Paystack and the atomic settlement RPC remain authoritative. */
export const recheckHubPaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { intentId: string }) => {
    const intentId = String(input?.intentId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(intentId)) throw new Error("Invalid intent ID.");
    return { intentId };
  })
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);
    const { data: intent, error } = await admin
      .from("hub_payment_intents")
      .select("id,service,amount_kobo,currency,payment_reference,paystack_domain,status")
      .eq("id", data.intentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!intent) throw new Error("Payment intent not found.");
    if (intent.service !== "cac" || intent.currency !== "NGN") {
      throw new Error("Only CAC payment intents are supported by this recheck.");
    }
    if (intent.status === "paid") {
      return {
        status: "already_paid" as const,
        message: "This intent is already paid. Refresh the order list.",
      };
    }
    if (!["pending", "expired"].includes(String(intent.status))) {
      return {
        status: "not_eligible" as const,
        message: "This payment intent is not eligible for rechecking.",
      };
    }

    const { getPaystackSecret, paystackVerify, classifyPaystackFunding } =
      await import("@/lib/paystack.server");
    const secret = getPaystackSecret();
    const domain = secret.startsWith("sk_test_") ? "test" : "live";
    if (intent.paystack_domain !== domain) throw new Error("Paystack environment mismatch.");
    const transaction = await paystackVerify(String(intent.payment_reference));
    if (!transaction) {
      return {
        status: "pending" as const,
        message: "Paystack verification is unavailable. Try again shortly.",
      };
    }
    const gatewayStatus = String(transaction.status ?? "").toLowerCase();
    if (gatewayStatus !== "success") {
      return {
        status: "pending" as const,
        message: "Paystack has not confirmed a successful payment.",
      };
    }
    if (transaction.domain && transaction.domain !== domain) {
      throw new Error("Paystack transaction domain mismatch.");
    }
    const expectedKobo = Number(intent.amount_kobo);
    if (!Number.isSafeInteger(expectedKobo) || expectedKobo <= 0) {
      throw new Error("Saved checkout amount is invalid.");
    }
    const classification = classifyPaystackFunding(
      transaction,
      String(intent.payment_reference),
      expectedKobo,
    );
    if (classification.kind === "mismatch") {
      return {
        status: "mismatch" as const,
        message: "Paystack transaction details do not match this checkout. No order was created.",
      };
    }
    const paidAtRaw = transaction.paid_at ?? transaction.paidAt;
    if (!paidAtRaw || !Number.isFinite(Date.parse(paidAtRaw))) {
      return {
        status: "timestamp_missing" as const,
        message: "Paystack did not return a valid payment timestamp. No order was created.",
      };
    }
    const transactionId = Number(classification.providerTransactionId);
    if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
      throw new Error("Invalid Paystack transaction ID.");
    }
    const { data: result, error: settleError } = await admin.rpc("finalize_hub_payment_intent", {
      _payment_reference: intent.payment_reference,
      _provider_transaction_id: transactionId,
      _paid_at: new Date(paidAtRaw).toISOString(),
    });
    if (settleError) {
      if (/outside.*validity|not eligible|expired/i.test(settleError.message)) {
        return {
          status: "outside_window" as const,
          message:
            "Payment was verified, but Paystack's timestamp falls outside the original checkout window. No order was created.",
        };
      }
      throw new Error(settleError.message);
    }
    const order = Array.isArray(result) ? result[0] : result;
    if (!order?.tracking_reference || !order?.user_id) {
      throw new Error("Settlement did not return the reconciled order details.");
    }

    // Recover notifications with the same stable event keys used by the webhook.
    const payload = (order.order_payload ?? {}) as Record<string, unknown>;
    const delivery = payload.delivery === "deliver" ? "deliver" : "download";
    const userId = String(order.user_id);
    const reference = String(intent.payment_reference);
    const amount = Number(order.amount ?? expectedKobo / 100);
    const trackingReference = String(order.tracking_reference);
    const preferredName = String(payload.preferredName ?? "CAC application");
    const eventKey = `hub-payment:${reference}:paid`;
    const [{ notifyStaffNewHubOrder }, { notifyUser }, { sendHubLifecycleEmail }] =
      await Promise.all([
        import("@/lib/hub-documents.functions"),
        import("@/lib/hub-notify.server"),
        import("@/lib/hub-email.server"),
      ]);
    const [staffNotice, customerNotice] = await Promise.all([
      notifyStaffNewHubOrder({
        service: "cac",
        amount,
        orderHint: preferredName,
        eventKey: `${eventKey}:staff`,
      }),
      notifyUser({
        userId,
        title: "CAC application received",
        message:
          delivery === "deliver"
            ? "We received your application. We’ll process it and deliver the printed pack to your address."
            : "We received your application. You’ll be notified when the certificate is ready to download.",
        type: "success",
        eventKey: `${eventKey}:customer:${userId}`,
      }),
    ]);
    if (!staffNotice.ok || !customerNotice.ok) {
      throw new Error("Payment is settled, but one or more in-app notifications need retry.");
    }
    void sendHubLifecycleEmail({
      userId,
      event: "paid",
      eventKey: `${eventKey}:email`,
      service: "cac",
      trackingReference,
      amount,
    }).catch((emailError) => {
      console.warn("[admin-payment-recheck] paid email enqueue failed", emailError);
    });

    return {
      status: "paid" as const,
      message: order.was_existing
        ? "The payment was already reconciled. No duplicate order was created."
        : "Payment verified and the CAC order was created.",
      orderId: String(order.order_id),
    };
  });

/** Staff-only overview of Hub checkout intents; excludes customer application payloads. */
export const getHubPaymentIntentSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertStaff(context.userId);
    const statuses = ["pending", "paid", "failed", "expired"] as const;
    const countResults = await Promise.all(
      statuses.map((status) =>
        admin
          .from("hub_payment_intents")
          .select("id", { count: "exact", head: true })
          .eq("status", status),
      ),
    );
    for (const result of countResults) {
      if (result.error) throw new Error(result.error.message);
    }
    const { data, error } = await admin
      .from("hub_payment_intents")
      .select("id,service,amount_kobo,status,payment_reference,created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    const counts = Object.fromEntries(
      statuses.map((status, index) => [status, countResults[index]?.count ?? 0]),
    ) as Record<(typeof statuses)[number], number>;
    return {
      counts,
      recent: (data ?? []).map(
        (row: {
          id: string;
          service: string;
          amount_kobo: number;
          status: string;
          payment_reference: string;
          created_at: string;
        }) => ({
          id: row.id,
          service: row.service,
          amountNaira: Number(row.amount_kobo) / 100,
          status: row.status,
          referenceSuffix: String(row.payment_reference).slice(-8),
          createdAt: row.created_at,
        }),
      ),
    };
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
    const { data: roles, error: rolesError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesError) throw new Error(rolesError.message);
    if (!roles?.some((row) => row.role === "admin" || row.role === "super_admin")) {
      throw new Error("Forbidden: only admins can change catalog pricing");
    }

    const { data: rows, error: lookupError } = await admin
      .from("pricing_rules")
      .select("id")
      .eq("service", data.service)
      .is("provider", null)
      .is("product_code", null)
      .eq("markup_type", "selling_price")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(2);
    if (lookupError) throw new Error(lookupError.message);
    if ((rows ?? []).length > 1) {
      throw new Error("Multiple active default pricing rules exist for this service. Resolve the duplicates before saving.");
    }

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
