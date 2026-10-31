/**
 * Customer My documents + staff-only CAC certificate delivery.
 * Completed certificates live in a private storage bucket and are served
 * through short-lived signed download URLs.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendHubLifecycleEmail } from "@/lib/hub-email.server";
import { notifyUser } from "@/lib/hub-notify.server";

const CERTIFICATE_BUCKET = "cac-certificates";
const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;

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
  delivery_method: string | null;
};

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
}

async function assertStaff(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message || "Staff check failed");
  if (data !== true) throw new Error("Forbidden: staff only");
  return supabaseAdmin;
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

    const documents: MyHubDocument[] = await Promise.all(
      (data ?? []).map(async (row) => {
        const m = asMeta(row.metadata);
        let url: string | null = null;
        const path =
          typeof m["certificate_storage_path"] === "string" ? m["certificate_storage_path"] : "";
        if (row.service === "cac" && path) {
          const { data: signed, error: signError } = await supabaseAdmin.storage
            .from(CERTIFICATE_BUCKET)
            .createSignedUrl(path, 300);
          if (!signError) url = signed?.signedUrl ?? null;
        } else if (row.service !== "cac") {
          // Backward compatibility for previously attached external document links.
          url =
            typeof m["document_url"] === "string"
              ? m["document_url"]
              : typeof m["certificate_url"] === "string"
                ? m["certificate_url"]
                : null;
        }
        return {
          id: row.id,
          service: row.service,
          amount: Number(row.amount),
          status: row.status,
          payment_reference: row.payment_reference,
          tracking_reference: row.tracking_reference,
          created_at: row.created_at,
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
      }),
    );
    return { documents };
  });

/** Create a one-use signed upload URL for a staff member and a paid CAC order. */
export const createCacCertificateUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orderId: string; fileName: string; size: number; contentType: string }) => {
      const orderId = String(input?.orderId ?? "").trim();
      const fileName = String(input?.fileName ?? "").trim();
      const size = Number(input?.size);
      const contentType = String(input?.contentType ?? "")
        .trim()
        .toLowerCase();
      if (!orderId) throw new Error("Missing order id");
      if (!fileName.toLowerCase().endsWith(".pdf") || contentType !== "application/pdf")
        throw new Error("Only PDF certificates are accepted.");
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_CERTIFICATE_BYTES)
        throw new Error("Certificate must be a PDF no larger than 10 MB.");
      return { orderId, size };
    },
  )
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);
    const { data: row, error } = await admin
      .from("hub_orders")
      .select("id, user_id, service, status, payment_reference, paid_at")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Order not found");
    if (row.service !== "cac") throw new Error("Certificates can only be attached to CAC orders.");
    if (!row.payment_reference || !row.paid_at || row.status === "failed")
      throw new Error("Only a payment-confirmed CAC order can receive a certificate.");

    const path = `${row.user_id}/${row.id}/${globalThis.crypto.randomUUID()}.pdf`;
    const { data: signed, error: uploadError } = await admin.storage
      .from(CERTIFICATE_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (uploadError || !signed?.token)
      throw new Error(uploadError?.message || "Could not prepare secure upload.");
    return { path, token: signed.token };
  });

/** Record that staff manually emailed the completed certificate outside RockPay. */
export const markCacCertificateEmailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; recipientEmail: string }) => {
    const orderId = String(input?.orderId ?? "").trim();
    const recipientEmail = String(input?.recipientEmail ?? "")
      .trim()
      .toLowerCase();
    if (!orderId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))
      throw new Error("Enter the email address that received the certificate.");
    return { orderId, recipientEmail };
  })
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);
    const { data: row, error } = await admin
      .from("hub_orders")
      .select("id, user_id, service, status, payment_reference, paid_at, metadata")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Order not found");
    if (row.service !== "cac") throw new Error("This action is only available for CAC orders.");
    if (!row.payment_reference || !row.paid_at || row.status === "failed")
      throw new Error("Only a payment-confirmed CAC order can be completed.");
    const previous = asMeta(row.metadata);
    if (typeof previous["certificate_storage_path"] === "string")
      throw new Error("A certificate is already available in the customer's documents.");
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("hub_orders")
      .update({
        status: "successful",
        metadata: {
          ...previous,
          certificate_delivery_method: "manual_email",
          certificate_emailed_at: now,
          certificate_emailed_to: data.recipientEmail,
          certificate_emailed_by: context.userId,
        },
        updated_at: now,
      } as never)
      .eq("id", data.orderId);
    if (updateError) throw new Error(updateError.message);
    await notifyUser({
      userId: row.user_id,
      title: "CAC certificate emailed",
      message: `Our team has marked your completed CAC certificate as emailed to ${data.recipientEmail}. Please check that inbox and its spam folder.`,
      type: "success",
      eventKey: `hub-order:${row.id}:cac-manual-email:${now}`,
    });
    return { ok: true as const, status: "successful" as const };
  });

/** Attach an uploaded private PDF and only then mark the CAC order complete. */
export const attachCacCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; storagePath: string }) => {
    const orderId = String(input?.orderId ?? "").trim();
    const storagePath = String(input?.storagePath ?? "").trim();
    if (!orderId || !storagePath) throw new Error("Missing order or certificate file.");
    return { orderId, storagePath };
  })
  .handler(async ({ data, context }) => {
    const admin = await assertStaff(context.userId);
    const { data: row, error: readError } = await admin
      .from("hub_orders")
      .select(
        "id, user_id, service, status, payment_reference, paid_at, metadata, tracking_reference, amount",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row) throw new Error("Order not found");
    if (row.service !== "cac")
      throw new Error("A CAC certificate can only be attached to a CAC order.");
    if (!row.payment_reference || !row.paid_at || row.status === "failed")
      throw new Error("Only a payment-confirmed CAC order can be completed.");

    const expectedPrefix = `${row.user_id}/${row.id}/`;
    if (
      !data.storagePath.startsWith(expectedPrefix) ||
      !/^[0-9a-f-]{36}\.pdf$/i.test(data.storagePath.slice(expectedPrefix.length))
    )
      throw new Error("Certificate storage path does not match this order.");

    const { data: file, error: fileError } = await admin.storage
      .from(CERTIFICATE_BUCKET)
      .download(data.storagePath);
    if (
      fileError ||
      !file ||
      file.size <= 0 ||
      file.size > MAX_CERTIFICATE_BYTES ||
      file.type !== "application/pdf"
    )
      throw new Error("The uploaded certificate could not be verified as a valid PDF.");

    const previous = asMeta(row.metadata);
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("hub_orders")
      .update({
        status: "successful",
        metadata: {
          ...previous,
          certificate_storage_path: data.storagePath,
          document_attached_at: now,
          document_attached_by: context.userId,
          fulfillment_status: "digital_ready",
        },
        updated_at: now,
      } as never)
      .eq("id", data.orderId);
    if (updateError) throw new Error(updateError.message);

    await notifyUser({
      userId: row.user_id,
      title: "CAC certificate ready",
      message:
        "Your completed CAC certificate is ready. Sign in and open Profile → My documents to download it securely.",
      type: "success",
      eventKey: `hub-order:${row.id}:cac-certificate-ready:${data.storagePath}`,
    });
    void sendHubLifecycleEmail({
      userId: row.user_id,
      event: "digital_ready",
      eventKey: `hub-order:${row.id}:digital_ready:email`,
      service: "cac",
      trackingReference: row.tracking_reference,
      amount: Number(row.amount),
    });
    return { ok: true as const, status: "successful" as const };
  });

export async function notifyCustomerHubStatus(input: {
  userId: string;
  service: string;
  status: string;
  eventKey?: string;
}) {
  const { customerCopyForStatus } = await import("@/lib/hub-notify.server");
  const copy = customerCopyForStatus(input.service, input.status);
  return notifyUser({
    userId: input.userId,
    title: copy.title,
    message: copy.message,
    type: copy.type,
    eventKey: input.eventKey,
  });
}

export async function notifyStaffNewHubOrder(input: {
  service: string;
  amount: number;
  orderHint: string;
  eventKey?: string;
}) {
  const { notifyStaff } = await import("@/lib/hub-notify.server");
  return notifyStaff({
    title: "New hub order",
    message: `${input.service.replace(/_/g, " ")} · ₦${Math.round(input.amount).toLocaleString("en-NG")} · ${input.orderHint}`,
    type: "pending",
    eventKey: input.eventKey,
  });
}
