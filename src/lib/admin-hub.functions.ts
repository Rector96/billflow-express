/**
 * Phase A — staff-only hub order + hub catalog fee mutations.
 * All handlers require Supabase auth + public.is_staff via service role check.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const HUB_CATALOG_SERVICES = [
  "tin",
  "documents",
  "cac",
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

export const listHubOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number; service?: string; status?: string } | undefined) => ({
    limit: Math.min(Math.max(Number(input?.limit ?? 100), 1), 200),
    service: String(input?.service ?? "").trim().toLowerCase(),
    status: String(input?.status ?? "").trim().toLowerCase(),
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

export const updateHubOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; status: string; note?: string }) => {
    const orderId = String(input?.orderId ?? "").trim();
    const status = String(input?.status ?? "").trim().toLowerCase();
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
      .select("id, metadata, status")
      .eq("id", data.orderId)
      .limit(1);
    if (readErr) throw new Error(readErr.message);
    const row = existing?.[0] as
      | { id: string; metadata: Record<string, unknown> | null; status: string }
      | undefined;
    if (!row) throw new Error("Order not found");

    const prevMeta =
      row.metadata && typeof row.metadata === "object" ? { ...row.metadata } : {};
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
    return { ok: true as const, status: data.status };
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

/** Updates markup_value (not base_price — that column does not exist). */
export const updateHubCatalogFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { service: string; markupValue: number }) => {
    const service = String(input?.service ?? "").trim().toLowerCase();
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
