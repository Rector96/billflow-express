/**
 * Hub production server functions (TanStack Start).
 *
 * SECURITY / FULFILLMENT RULE:
 * - Payment verification happens on the server.
 * - A payment is never treated as successful fulfillment by itself.
 * - Government/regulated services must have a real provider result before we
 *   return a successful result to the customer.
 * - Dojah is optional during development, but missing Dojah access MUST make
 *   TIN/vehicle verification unavailable — never fabricate government data.
 * - Demo/simulated providers are intentionally removed from production paths.
 *
 * This file is deliberately documented so the next developer can continue the
 * implementation safely when real provider credentials become available.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RecoverTinSuccess } from "@/lib/hub-api.types";
import { SERVICE_PRICES, type HubPriceKey } from "@/lib/hub-service-prices";
import { isBillLive } from "@/lib/product-mode";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function slugToPriceKey(slug: string): HubPriceKey | null {
  const s = slug.toLowerCase();
  if (s === "tin" || s === "tin_retrieve") return "tin_retrieve";
  if (s === "documents" || s === "document_generator") return "document_generator";
  if (s === "vehicle" || s === "vehicle_renewal") return "vehicle_renewal";
  if (s === "vehicle_license_sticker") return "vehicle_license_sticker";
  if (s === "vehicle_third_party_insurance") return "vehicle_third_party_insurance";
  if (s === "cac") return "cac_registration";
  if (s === "nin_retrieve") return "nin_retrieve";
  if (s === "nin_slip") return "nin_slip";
  if (s === "nin_card_print" || s === "nin_plastic_card") return "nin_plastic_card";
  return null;
}

export const getHubServiceFee = createServerFn({ method: "GET" })
  .inputValidator((input: { serviceSlug: string }) => ({
    serviceSlug: String(input?.serviceSlug ?? "").trim().toLowerCase(),
  }))
  .handler(async ({ data }): Promise<{ fee: number; source: "db" | "fallback" }> => {
    const slug = data.serviceSlug;
    const key = slugToPriceKey(slug);
    if (!key) throw new Error("Unsupported hub service.");
    const fallback = SERVICE_PRICES[key];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("pricing_rules")
        .select("markup_type, markup_value, service, is_active, priority")
        .eq("service", slug)
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(5);
      if (error || !rows?.length) return { fee: fallback, source: "fallback" };
      const row = rows[0] as { markup_type?: string; markup_value?: number };
      const type = String(row.markup_type ?? "").toLowerCase();
      const value = Number(row.markup_value ?? 0);
      if ((type === "selling_price" || type === "fixed") && Number.isFinite(value) && value > 0) {
        return { fee: Math.round(value), source: "db" };
      }
      return { fee: fallback, source: "fallback" };
    } catch {
      return { fee: fallback, source: "fallback" };
    }
  });

export const recoverTin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      identifier: string;
      identifierType: "nin" | "cac";
      fullName: string;
      paymentReference: string;
      amount: number;
    }) => {
      const identifier = String(input?.identifier ?? "").replace(/\s/g, "").trim();
      if (identifier.length < 5) throw new Error("Enter a valid NIN or CAC number.");
      const fullName = String(input?.fullName ?? "").trim();
      if (fullName.length < 2) throw new Error("Enter the full name on the record.");
      const paymentReference = String(input?.paymentReference ?? "").trim();
      if (!paymentReference) throw new Error("Missing payment reference.");
      const amount = Math.round(Number(input?.amount));
      if (!Number.isFinite(amount) || amount < 1) throw new Error("Invalid amount.");
      const identifierType = input?.identifierType === "cac" ? "cac" : "nin";
      return { identifier, identifierType, fullName, paymentReference, amount };
    },
  )
  .handler(async ({ data, context }): Promise<RecoverTinSuccess> => {
    // The route and provider are both required. This second gate prevents a
    // direct server-function call from bypassing the public service status.
    if (!isBillLive("tin")) {
      throw new Error("TIN retrieval is temporarily unavailable.");
    }

    // IMPORTANT: Provider availability is checked BEFORE payment verification.
    // Without a real TIN provider we cannot fulfil the customer's order, so we
    // refuse the operation instead of accepting money for fabricated data.
    const { dojahLookupCompanyTin, isDojahConfigured } = await import("./dojah.server");
    if (data.identifierType !== "cac" || !isDojahConfigured()) {
      throw new Error(
        "TIN retrieval is temporarily unavailable. A verified TIN provider is required before this service can be purchased.",
      );
    }

    await assertPaystackSuccess(data.paymentReference, data.amount);

    let tinPayload: {
      tin: string;
      taxpayerName: string;
      taxpayerType: "individual" | "business";
      cacNumber: string | null;
      nin: string | null;
      rawProvider: string;
    };

    try {
      const r = await dojahLookupCompanyTin({ rcNumber: data.identifier });
      tinPayload = { ...r, taxpayerName: r.taxpayerName || data.fullName };
    } catch (e) {
      // Do not turn provider errors into a successful/locally generated TIN.
      throw new Error(e instanceof Error ? e.message : "TIN lookup failed.");
    }

    const track = uid("TIN");
    await logHubOrder({
      userId: context.userId,
      service: "tin",
      amount: data.amount,
      paymentReference: data.paymentReference,
      trackingReference: track,
      customerIdentifier: data.identifier,
      metadata: {
        tin: tinPayload.tin,
        taxpayerName: tinPayload.taxpayerName,
        identifierType: data.identifierType,
        rawProvider: tinPayload.rawProvider,
      },
    });

    return {
      status: "success",
      data: {
        tin: tinPayload.tin,
        taxpayerName: tinPayload.taxpayerName,
        taxpayerType: tinPayload.taxpayerType,
        jtbRegistered: true,
        cacNumber: tinPayload.cacNumber,
        nin: tinPayload.nin,
        email: null,
        phone: null,
        rawProvider: tinPayload.rawProvider,
      },
      meta: {
        paymentReference: data.paymentReference,
        requestId: track,
        fee: data.amount,
      },
    };
  });

export const verifyVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plate: string; state: string }) => {
    const plate = String(input?.plate ?? "")
      .replace(/\s+/g, "")
      .toUpperCase();
    if (plate.length < 5) throw new Error("Enter a valid license plate.");
    const state = String(input?.state ?? "").trim() || "Lagos";
    return { plate, state };
  })
  .handler(async ({ data }) => {
    if (!isBillLive("vehicle")) {
      throw new Error("Vehicle verification is temporarily unavailable.");
    }

    // Vehicle registry information is regulated data. Never return a synthetic
    // vehicle record when the provider is missing or unavailable.
    const { dojahLookupVehicle, isDojahConfigured } = await import("./dojah.server");
    if (!isDojahConfigured()) {
      throw new Error(
        "Vehicle verification is temporarily unavailable. A verified vehicle registry provider is required.",
      );
    }

    try {
      return await dojahLookupVehicle(data);
    } catch (e) {
      console.warn("[hub] verifyVehicle dojah", e instanceof Error ? e.message : e);
      throw new Error(e instanceof Error ? e.message : "Vehicle verification failed.");
    }
  });

export const completeVehicleRenewal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      plate: string;
      state: string;
      makeModel: string;
      choice: "license_sticker" | "third_party_insurance";
      paymentReference: string;
      amount: number;
    }) => {
      const plate = String(input?.plate ?? "")
        .replace(/\s+/g, "")
        .toUpperCase();
      if (plate.length < 5) throw new Error("Invalid plate.");
      const choice =
        input?.choice === "third_party_insurance" ? "third_party_insurance" : "license_sticker";
      const paymentReference = String(input?.paymentReference ?? "").trim();
      if (!paymentReference) throw new Error("Missing payment reference.");
      const amount = Math.round(Number(input?.amount));
      if (!Number.isFinite(amount) || amount < 1) throw new Error("Invalid amount.");
      return {
        plate,
        state: String(input?.state ?? "Lagos"),
        makeModel: String(input?.makeModel ?? ""),
        choice,
        paymentReference,
        amount,
      };
    },
  )
  .handler(async ({ data, context }) => {
    // Server-side defense in depth: the renewal endpoint must remain closed
    // until an authorized renewal/insurance fulfillment provider exists.
    if (!isBillLive("vehicle")) {
      throw new Error("Vehicle renewal is temporarily unavailable.");
    }

    await assertPaystackSuccess(data.paymentReference, data.amount);
    const trackingReference = `VR-${Date.now().toString(36).toUpperCase()}-${data.plate.slice(0, 6)}`;
    await logHubOrder({
      userId: context.userId,
      service: data.choice,
      amount: data.amount,
      paymentReference: data.paymentReference,
      trackingReference,
      customerIdentifier: data.plate,
      metadata: {
        plate: data.plate,
        state: data.state,
        makeModel: data.makeModel,
        delivery:
          data.choice === "third_party_insurance" ? "digital_pdf" : "physical_sticker",
      },
    });
    return {
      ok: true as const,
      trackingReference,
      paymentReference: data.paymentReference,
      choice: data.choice,
    };
  });

export const recordHubPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      service: string;
      amount: number;
      paymentReference: string;
      metadata?: Record<string, unknown>;
    }) => ({
      service: String(input?.service ?? "").trim(),
      amount: Math.round(Number(input?.amount)),
      paymentReference: String(input?.paymentReference ?? "").trim(),
      metadata:
        input?.metadata && typeof input.metadata === "object"
          ? (input.metadata as Record<string, unknown>)
          : {},
    }),
  )
  .handler(async ({ data, context }) => {
    // Generic hub payment recording is only allowed for a service that the
    // central production gate explicitly marks live. This prevents a caller
    // from turning a Paystack reference into an arbitrary "successful" order.
    if (!isBillLive(data.service)) {
      throw new Error("This service is not currently available for payment.");
    }

    await assertPaystackSuccess(data.paymentReference, data.amount);
    await logHubOrder({
      userId: context.userId,
      service: data.service,
      amount: data.amount,
      paymentReference: data.paymentReference,
      trackingReference: uid("HUB"),
      customerIdentifier: null,
      metadata: data.metadata,
    });
    return { ok: true as const, reference: data.paymentReference };
  });

/**
 * Verify Paystack when secret is set.
 * Demo references are accepted only when HUB_ALLOW_UNVERIFIED_PAY=true.
 * That flag is intended for local UI tests only and must remain false in
 * production. A real payment reference is always verified against Paystack.
 */
async function assertPaystackSuccess(reference: string, expectedNaira: number) {
  const secret = String(process.env["PAYSTACK_SECRET_KEY"] ?? "").trim();
  const allowUnverified = String(process.env["HUB_ALLOW_UNVERIFIED_PAY"] ?? "") === "true";

  if (!secret) {
    if (allowUnverified && reference.startsWith("PSK_DEMO_")) return;
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set on the server. Add it in Netlify env and redeploy.",
    );
  }

  if (reference.startsWith("PSK_DEMO_")) {
    if (allowUnverified) return;
    throw new Error(
      "Demo payment was used but Paystack is configured. Use a real Paystack checkout reference.",
    );
  }

  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
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
}

async function logHubOrder(input: {
  userId: string;
  service: string;
  amount: number;
  paymentReference: string;
  trackingReference: string | null;
  customerIdentifier: string | null;
  metadata: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error: hubErr } = await supabaseAdmin.from("hub_orders").insert({
    user_id: input.userId,
    service: input.service,
    amount: input.amount,
    status: "successful",
    payment_reference: input.paymentReference,
    tracking_reference: input.trackingReference,
    customer_identifier: input.customerIdentifier,
    metadata: { channel: "hub", ...input.metadata },
  } as never);

  if (hubErr) {
    console.warn("[hub] hub_orders insert", hubErr.message);
  }

  try {
    const ref = input.trackingReference || input.paymentReference;
    const { error } = await supabaseAdmin.from("bill_transactions").insert({
      user_id: input.userId,
      service: input.service,
      provider: "hub",
      product: input.service,
      amount: input.amount,
      customer_identifier: input.customerIdentifier,
      internal_reference: ref,
      status: "successful",
      provider_request_id: input.paymentReference,
      metadata: {
        channel: "hub",
        title: `Hub · ${input.service}`,
        service_slug: input.service,
        payment_reference: input.paymentReference,
        ...input.metadata,
      },
    } as never);
    if (error) console.warn("[hub] bill_transactions mirror", error.message);
  } catch (e) {
    console.warn("[hub] bill mirror failed", e);
  }
}
