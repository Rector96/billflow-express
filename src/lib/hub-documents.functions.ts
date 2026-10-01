/**
 * Customer My documents + staff attach download URL on hub_orders.metadata.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendHubLifecycleEmail } from "@/lib/hub-email.server";
import { customerCopyForStatus, notifyStaff, notifyUser } from "@/lib/hub-notify.server";

export type MyHubDocument = {
  id: string;
  service: string;
  amount: number;
  status: string;
  payment_reference: string | null;
  tracking_reference: string | null;
  created_at: string;
  document_url: string | null;
  delivery: string | null;
  shipping_address: string | null;
  fulfillment_status: string | null;
};

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
}

export const listMyHubDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ documents: MyHubDocument[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("hub_orders")
      .select(
        "id, service, amount, status, payment_reference, tracking_reference, metadata, created_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const documents: MyHubDocument[] = (data ?? []).map((row) => {
      const r = row as {
        id: string;
        service: string;
        amount: number;
        status: string;
        payment_reference: string | null;
        tracking_reference: string | null;
        metadata: unknown;
        created_at: string;
      };
      const m = asMeta(r.metadata);
      const url =
        typeof m["document_url"] === "string"
          ? m["document_url"]
          : typeof m["certificate_url"] === "string"
            ? m["certificate_url"]
            : null;
      return {
        id: r.id,
        service: r.service,
        amount: Number(r.amount),
        status: r.status,
        payment_reference: r.payment_reference,
        tracking_reference: r.tracking_reference,
        created_at: r.created_at,
        document_url: url,
        delivery: typeof m["delivery"] === "string" ? m["delivery"] : null,
        shipping_address:
          typeof m["shipping_address"] === "string"
            ? m["shipping_address"]
            : typeof m["shippingAddress"] === "string"
              ? m["shippingAddress"]
              : null,
        fulfillment_status:
          typeof m["fulfillment_status"] === "string" ? m["fulfillment_status"] : null,
      };
    });
    return { documents };
  });

async function assertStaff(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message || "Staff check failed");
  if (data !== true) throw new Error("Forbidden: staff only");
  return supabaseAdmin;
}

/** Staff pastes a public HTTPS link (Drive, Supabase storage, CDN) for the customer to download. */
export const attachHubDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; documentUrl: string; markReady?: boolean }) => {
    const orderId = String(input?.orderId ?? "").trim();
    const documentUrl = String(input?.documentUrl ?? "").trim();
    if (!orderId) throw new Error("Missing order id");
    if (!/^https:\/\//i.test(documentUrl))
      throw new Error("Document link must start with https://");
    if (documentUrl.length > 2000) throw new Error("Link is too long");
    return { orderId, documentUrl, markReady: input?.markReady !== false };
  })
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);
    const { data: existing, error: readErr } = await admin
      .from("hub_orders")
      .select("id, user_id, service, status, metadata, tracking_reference, amount")
      .eq("id", data.orderId)
      .limit(1);
    if (readErr) throw new Error(readErr.message);
    const row = existing?.[0] as
      | {
          id: string;
          user_id: string;
          service: string;
          status: string;
          metadata: unknown;
          tracking_reference: string | null;
          amount: number;
        }
      | undefined;
    if (!row) throw new Error("Order not found");

    const prevMeta = asMeta(row.metadata);
    const nextStatus = data.markReady ? "successful" : row.status;
    const { error } = await admin
      .from("hub_orders")
      .update({
        status: nextStatus,
        metadata: {
          ...prevMeta,
          document_url: data.documentUrl,
          document_attached_at: new Date().toISOString(),
          document_attached_by: context.userId,
          fulfillment_status: data.markReady ? "digital_ready" : prevMeta["fulfillment_status"],
        },
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);

    const copy = customerCopyForStatus(row.service, data.markReady ? "successful" : row.status);
    await notifyUser({
      userId: row.user_id,
      title: data.markReady ? `${row.service.replace(/_/g, " ")} — ready to download` : copy.title,
      message: data.markReady
        ? "Your file is ready. Open Profile → My documents to download."
        : copy.message,
      type: "success",
    });

    await notifyStaff({
      title: "Document attached",
      message: `Order ${data.orderId.slice(0, 8)}… (${row.service}) has a download link.`,
      type: "information",
    });

    if (data.markReady) {
      void sendHubLifecycleEmail({
        userId: row.user_id,
        event: "digital_ready",
        service: row.service,
        trackingReference: row.tracking_reference,
        amount: row.amount,
      });
    }

    return { ok: true as const, status: nextStatus };
  });

export async function notifyCustomerHubStatus(input: {
  userId: string;
  service: string;
  status: string;
}) {
  const copy = customerCopyForStatus(input.service, input.status);
  await notifyUser({
    userId: input.userId,
    title: copy.title,
    message: copy.message,
    type: copy.type,
  });
}

export async function notifyStaffNewHubOrder(input: {
  service: string;
  amount: number;
  orderHint: string;
}) {
  await notifyStaff({
    title: "New hub order",
    message: `${input.service.replace(/_/g, " ")} · ₦${Math.round(input.amount).toLocaleString("en-NG")} · ${input.orderHint}`,
    type: "pending",
  });
}
