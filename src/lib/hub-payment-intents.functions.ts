/**
 * Server-owned Paystack intents for RockPay Hub checkout.
 *
 * The browser supplies a service selection and order details only. Price,
 * customer identity, reference, currency and Paystack environment are resolved
 * on the server and persisted before the client opens Paystack Inline.
 */
import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";

const HUB_SERVICES = [
  "cac",
  "nin_retrieve",
  "nin_slip",
  "nin_card_print",
  "vehicle_license_sticker",
  "vehicle_third_party_insurance",
  "documents",
] as const;

type HubService = (typeof HUB_SERVICES)[number];

function cleanText(value: unknown, max = 500): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function requiredText(value: unknown, label: string, max = 500): string {
  const result = cleanText(value, max);
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function cleanShipping(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const output: Record<string, string> = {};
  for (const key of ["phone", "street", "area", "lga", "state"]) {
    const item = cleanText(input[key], 160);
    if (item) output[key] = item;
  }
  return output;
}

function validateOrderPayload(service: HubService, raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Order details are required.");
  }
  const input = raw as Record<string, unknown>;

  if (service === "cac") {
    const nin = cleanText(input.nin).replace(/\D/g, "");
    if (nin.length !== 11) throw new Error("A valid 11-digit NIN is required.");
    const delivery = input.delivery === "deliver" ? "deliver" : "download";
    const shippingAddress = cleanText(input.shippingAddress, 500);
    const shipping = cleanShipping(input.shipping);
    if (delivery === "deliver" && !shippingAddress) {
      throw new Error("A delivery address is required.");
    }
    return {
      preferredName: requiredText(input.preferredName, "Business name", 160),
      nature: requiredText(input.nature, "Business activity", 160),
      ownerName: requiredText(input.ownerName, "Owner name", 160),
      nin,
      ownerPhone: requiredText(input.ownerPhone, "Owner phone", 32),
      ownerEmail: cleanText(input.ownerEmail, 254).toLowerCase(),
      businessAddress: requiredText(input.businessAddress, "Business address", 500),
      delivery,
      shippingAddress: delivery === "deliver" ? shippingAddress : "",
      shipping: delivery === "deliver" ? shipping : {},
    };
  }

  if (service === "nin_retrieve" || service === "nin_slip" || service === "nin_card_print") {
    const nin = cleanText(input.nin).replace(/\D/g, "");
    const phone = cleanText(input.phone, 32);
    if (nin.length !== 11 && phone.replace(/\D/g, "").length < 10) {
      throw new Error("Enter a valid NIN or phone number.");
    }
    const delivery = service === "nin_card_print";
    const shippingAddress = cleanText(input.shippingAddress, 500);
    if (delivery && !shippingAddress) throw new Error("A delivery address is required.");
    return {
      product:
        service === "nin_retrieve"
          ? "retrieve"
          : service === "nin_slip"
            ? "slip_pdf"
            : "plastic_card",
      nin,
      phone,
      delivery: delivery ? "deliver" : "download",
      shippingAddress: delivery ? shippingAddress : "",
      shipping: delivery ? cleanShipping(input.shipping) : {},
    };
  }

  if (service === "vehicle_license_sticker" || service === "vehicle_third_party_insurance") {
    const plate = requiredText(input.plate, "Vehicle plate", 20).replace(/\s+/g, "").toUpperCase();
    if (plate.length < 5) throw new Error("Enter a valid vehicle plate.");
    const delivery = service === "vehicle_license_sticker";
    const shippingAddress = cleanText(input.shippingAddress, 500);
    if (delivery && !shippingAddress) throw new Error("A delivery address is required.");
    return {
      plate,
      state: requiredText(input.state, "Vehicle state", 80),
      makeModel: cleanText(input.makeModel, 120),
      delivery: delivery ? "deliver" : "download",
      shippingAddress: delivery ? shippingAddress : "",
    };
  }

  if (service === "documents") {
    const documentType =
      input.documentType === "constitution"
        ? "constitution"
        : input.documentType === "tenancy"
          ? "tenancy"
          : null;
    if (!documentType) throw new Error("Choose a supported document type.");
    const partyA = requiredText(
      input.partyA,
      documentType === "tenancy" ? "Landlord name" : "Business name",
      160,
    );
    const partyB = requiredText(
      input.partyB,
      documentType === "tenancy" ? "Tenant name" : "Manager name",
      160,
    );
    const address = requiredText(input.address, "Address", 500);
    return {
      documentType,
      partyA,
      partyB,
      address,
      rent: documentType === "tenancy" ? cleanText(input.rent, 40) : "",
      duration: documentType === "tenancy" ? cleanText(input.duration, 40) : "",
      delivery: "download",
    };
  }

  throw new Error("Unsupported Hub service.");
}

async function resolveHubAmount(
  service: HubService,
  payload: Record<string, unknown>,
): Promise<number> {
  const fees = await loadHubFeesFromSupabase();
  let amount = 0;
  switch (service) {
    case "cac":
      amount = Number(fees.cac || 0);
      if (payload.delivery === "deliver") amount += Number(fees.cac_courier || 0);
      break;
    case "nin_retrieve":
    case "nin_slip":
      amount = Number(fees[service] || 0);
      break;
    case "nin_card_print":
      amount = Number(fees.nin_card_print || fees.nin_plastic_card || 0);
      if (payload.delivery === "deliver") amount += Number(fees.nin_courier || 0);
      break;
    case "vehicle_license_sticker":
    case "vehicle_third_party_insurance":
      amount = Number(fees[service] || 0);
      break;
    case "documents":
      amount = Number(fees.documents || 0);
      break;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("The price for this Hub service is unavailable. Please try again later.");
  }
  return Math.round(amount * 100) / 100;
}

export const createHubPaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { service: string; orderDetails: Record<string, unknown> }) => {
    const service = cleanText(input?.service, 80).toLowerCase();
    if (!HUB_SERVICES.includes(service as HubService)) {
      throw new Error("Unsupported Hub service.");
    }
    return {
      service: service as HubService,
      orderDetails: input?.orderDetails,
    };
  })
  .handler(async ({ data, context }) => {
    const email = cleanText((context.claims as Record<string, unknown>)?.email, 254).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Your account email is unavailable. Please sign in again.");
    }

    const secret = cleanText(process.env["PAYSTACK_SECRET_KEY"], 300);
    const paystackDomain = secret.startsWith("sk_test_")
      ? "test"
      : secret.startsWith("sk_live_")
        ? "live"
        : null;
    if (!paystackDomain) {
      throw new Error("A valid Paystack Test or Live Secret Key is not configured on the server.");
    }

    const orderPayload = validateOrderPayload(data.service, data.orderDetails);
    const amountNaira = await resolveHubAmount(data.service, orderPayload);
    const amountKobo = Math.round(amountNaira * 100);
    const paymentReference = `RP-HUB-${randomUUID().replace(/-/g, "").toUpperCase()}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- hub_payment_intents is a new table not yet present in generated Supabase types.
    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("hub_payment_intents")
      .insert({
        user_id: context.userId,
        service: data.service,
        amount_kobo: amountKobo,
        currency: "NGN",
        payment_reference: paymentReference,
        paystack_domain: paystackDomain,
        status: "pending",
        order_payload: orderPayload,
      })
      .select("id")
      .single();

    if (error || !inserted?.id) {
      console.error("[hub-payment-intent] insert failed", error?.message ?? "missing row");
      throw new Error("Could not prepare your secure checkout. Please try again.");
    }

    return {
      intentId: String(inserted.id),
      email,
      service: data.service,
      amountNaira,
      amountKobo,
      currency: "NGN" as const,
      reference: paymentReference,
      domain: paystackDomain,
    };
  });
