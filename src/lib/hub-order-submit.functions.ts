/**
 * CAC & NIN applications → hub_orders + staff/user notify + Resend.
 *
 * Payment rules:
 * - If PAYSTACK_SECRET_KEY is set: require a real Paystack reference and verify it.
 * - Demo refs (PSK_DEMO_*) only when HUB_ALLOW_UNVERIFIED_PAY=true or
 *   HUB_PREVIEW_FLOWS allows unverified pay (see hub-preview.server).
 * - Webhook path remains the secondary recorder (idempotent on payment_reference).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyStaffNewHubOrder } from "@/lib/hub-documents.functions";
import { sendHubLifecycleEmail } from "@/lib/hub-email.server";
import { notifyUser } from "@/lib/hub-notify.server";
import {
  isHubPreviewServerEnabled,
  isHubUnverifiedPayAllowed,
} from "@/lib/hub-preview.server";
import { SERVICE_PRICES } from "@/lib/hub-service-prices";
import { isBillLive } from "@/lib/product-mode";

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function paystackSecret(): string {
  return String(process.env["PAYSTACK_SECRET_KEY"] ?? "").trim();
}

/**
 * Verify Paystack charge when secret is configured.
 * Demo references only when unverified pay is explicitly allowed.
 */
async function assertHubPayment(
  reference: string,
  expectedNaira: number,
): Promise<{ demo: boolean }> {
  const ref = String(reference ?? "").trim();
  if (!ref) {
    throw new Error("Payment reference is required. Complete Paystack checkout first.");
  }

  const secret = paystackSecret();
  const allowDemo = isHubUnverifiedPayAllowed();
  const isDemoRef = ref.startsWith("PSK_DEMO_");

  if (!secret) {
    if (allowDemo || isDemoRef) return { demo: true };
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set on the server. Add it in Netlify env and redeploy.",
    );
  }

  if (isDemoRef) {
    if (allowDemo) return { demo: true };
    throw new Error(
      "Demo payment was used but Paystack is configured. Complete a real Paystack checkout.",
    );
  }

  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`,
    { headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" } },
  );
  const json = (await res.json()) as {
    status?: boolean;
    data?: { status?: string; amount?: number };
    message?: string;
  };
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Could not verify payment with Paystack.");
  }
  if (String(json.data?.status).toLowerCase() !== "success") {
    throw new Error("Payment was not successful.");
  }
  const kobo = Number(json.data?.amount ?? 0);
  const expectedKobo = Math.round(expectedNaira * 100);
  if (Number.isFinite(expectedKobo) && expectedKobo > 0 && Math.abs(kobo - expectedKobo) > 100) {
    throw new Error("Paid amount does not match the service fee.");
  }
  return { demo: false };
}

async function insertHubOrder(input: {
  userId: string;
  service: string;
  amount: number;
  paymentReference: string;
  trackingReference: string;
  customerIdentifier: string | null;
  metadata: Record<string, unknown>;
  status?: string;
  demo: boolean;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const status = input.status ?? "pending";
  const now = new Date().toISOString();

  const { data: row, error } = await supabaseAdmin
    .from("hub_orders")
    .insert({
      user_id: input.userId,
      service: input.service,
      amount: input.amount,
      status,
      payment_reference: input.paymentReference,
      tracking_reference: input.trackingReference,
      customer_identifier: input.customerIdentifier,
      fulfillment_status: "paid",
      paid_at: now,
      metadata: {
        channel: "hub",
        demo: input.demo,
        fulfillment_status: "paid",
        source: input.demo ? "hub_submit_preview" : "hub_submit_paystack",
        ...input.metadata,
      },
    } as never)
    .select("id")
    .limit(1);

  if (error) throw new Error(error.message || "Could not save application order");

  try {
    await supabaseAdmin.from("bill_transactions").insert({
      user_id: input.userId,
      service: input.service,
      provider: "hub",
      product: input.service,
      amount: input.amount,
      customer_identifier: input.customerIdentifier,
      internal_reference: input.trackingReference,
      status,
      provider_request_id: input.paymentReference,
      metadata: {
        channel: "hub",
        title: `Hub · ${input.service}`,
        service_slug: input.service,
        payment_reference: input.paymentReference,
        demo: input.demo,
        ...input.metadata,
      },
    } as never);
  } catch {
    /* mirror optional */
  }

  return { orderId: (row?.[0] as { id?: string } | undefined)?.id ?? null };
}

export const submitCacApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      amount: number;
      delivery: "download" | "deliver";
      preferredName: string;
      nature: string;
      ownerName: string;
      nin: string;
      ownerPhone: string;
      ownerEmail: string;
      businessAddress: string;
      shippingAddress?: string;
      shipping?: Record<string, string>;
      paymentReference?: string;
    }) => {
      const amount = Math.round(Number(input?.amount));
      if (!Number.isFinite(amount) || amount < 1) throw new Error("Invalid amount");
      const delivery = input?.delivery === "deliver" ? "deliver" : "download";
      const preferredName = String(input?.preferredName ?? "").trim();
      if (!preferredName) throw new Error("Business name is required");
      const nin = String(input?.nin ?? "").replace(/\D/g, "");
      if (nin.length !== 11) throw new Error("Valid 11-digit NIN required");
      return {
        amount,
        delivery,
        preferredName,
        nature: String(input?.nature ?? "").trim(),
        ownerName: String(input?.ownerName ?? "").trim(),
        nin,
        ownerPhone: String(input?.ownerPhone ?? "").trim(),
        ownerEmail: String(input?.ownerEmail ?? "").trim(),
        businessAddress: String(input?.businessAddress ?? "").trim(),
        shippingAddress: String(input?.shippingAddress ?? "").trim(),
        shipping:
          input?.shipping && typeof input.shipping === "object"
            ? (input.shipping as Record<string, string>)
            : {},
        paymentReference: String(input?.paymentReference ?? "").trim(),
      };
    },
  )
  .handler(async ({ data, context }) => {
    if (!isBillLive("cac") && !isHubPreviewServerEnabled()) {
      throw new Error("CAC registration is not available right now.");
    }

    const trackingReference = uid("CAC");
    const paymentReference =
      data.paymentReference ||
      (isHubUnverifiedPayAllowed() ? `PSK_DEMO_${trackingReference}` : "");

    const { demo } = await assertHubPayment(paymentReference, data.amount);

    await insertHubOrder({
      userId: context.userId,
      service: "cac",
      amount: data.amount,
      paymentReference,
      trackingReference,
      customerIdentifier: data.nin,
      status: "pending",
      demo,
      metadata: {
        preferred_name: data.preferredName,
        nature: data.nature,
        owner_name: data.ownerName,
        nin: data.nin,
        owner_phone: data.ownerPhone,
        owner_email: data.ownerEmail,
        business_address: data.businessAddress,
        delivery: data.delivery,
        shipping_address: data.delivery === "deliver" ? data.shippingAddress : null,
        shipping: data.delivery === "deliver" ? data.shipping : null,
        fulfillment_status: "paid",
      },
    });

    await notifyStaffNewHubOrder({
      service: "cac",
      amount: data.amount,
      orderHint: data.preferredName,
    });

    await notifyUser({
      userId: context.userId,
      title: "CAC application received",
      message:
        data.delivery === "deliver"
          ? "We received your application. We’ll process it and deliver the printed pack to your address."
          : "We received your application. You’ll be notified when the certificate is ready to download.",
      type: "success",
    });

    void sendHubLifecycleEmail({
      userId: context.userId,
      event: "paid",
      service: "cac",
      trackingReference,
      amount: data.amount,
    });

    return {
      ok: true as const,
      trackingReference,
      paymentReference,
      amount: data.amount,
      demo,
    };
  });

export const submitNinOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      product: "retrieve" | "slip_pdf" | "plastic_card";
      amount: number;
      phone?: string;
      nin?: string;
      shippingAddress?: string;
      shipping?: Record<string, string>;
      paymentReference?: string;
    }) => {
      const product = input?.product;
      if (product !== "retrieve" && product !== "slip_pdf" && product !== "plastic_card") {
        throw new Error("Invalid NIN product");
      }
      const amount = Math.round(Number(input?.amount));
      if (!Number.isFinite(amount) || amount < 1) throw new Error("Invalid amount");
      return {
        product,
        amount,
        phone: String(input?.phone ?? "").trim(),
        nin: String(input?.nin ?? "").replace(/\D/g, ""),
        shippingAddress: String(input?.shippingAddress ?? "").trim(),
        shipping:
          input?.shipping && typeof input.shipping === "object"
            ? (input.shipping as Record<string, string>)
            : {},
        paymentReference: String(input?.paymentReference ?? "").trim(),
      };
    },
  )
  .handler(async ({ data, context }) => {
    if (!isBillLive("nin") && !isHubPreviewServerEnabled()) {
      throw new Error("NIN services are not available right now.");
    }

    const service =
      data.product === "retrieve"
        ? "nin_retrieve"
        : data.product === "slip_pdf"
          ? "nin_slip"
          : "nin_card_print";

    const trackingReference = uid("NIN");
    const paymentReference =
      data.paymentReference ||
      (isHubUnverifiedPayAllowed() ? `PSK_DEMO_${trackingReference}` : "");
    const needsDeliver = data.product === "plastic_card";

    const { demo } = await assertHubPayment(paymentReference, data.amount);

    await insertHubOrder({
      userId: context.userId,
      service,
      amount: data.amount,
      paymentReference,
      trackingReference,
      customerIdentifier: data.nin || data.phone || null,
      status: "pending",
      demo,
      metadata: {
        product: data.product,
        phone: data.phone || null,
        nin: data.nin || null,
        delivery: needsDeliver ? "deliver" : "download",
        shipping_address: needsDeliver ? data.shippingAddress : null,
        shipping: needsDeliver ? data.shipping : null,
        fulfillment_status: "paid",
      },
    });

    await notifyStaffNewHubOrder({
      service,
      amount: data.amount,
      orderHint: data.nin || data.phone || trackingReference,
    });

    await notifyUser({
      userId: context.userId,
      title: "NIN order received",
      message: needsDeliver
        ? "Payment recorded. Your plastic card will be prepared for delivery."
        : "Payment recorded. We’ll notify you when your digital result is ready.",
      type: "success",
    });

    void sendHubLifecycleEmail({
      userId: context.userId,
      event: "paid",
      service,
      trackingReference,
      amount: data.amount,
    });

    return {
      ok: true as const,
      trackingReference,
      paymentReference,
      service,
      amount: data.amount,
      demo,
    };
  });

export const CAC_DEFAULT_AMOUNT = SERVICE_PRICES.cac_registration;
