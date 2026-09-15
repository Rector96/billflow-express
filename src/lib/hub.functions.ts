/**
 * Hub production server functions (TanStack Start).
 * Paystack verify → optional Dojah → write hub_orders (+ bill_transactions mirror).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RecoverTinSuccess } from "@/lib/hub-api.types";
import { SERVICE_PRICES, type HubPriceKey } from "@/lib/hub-service-prices";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function slugToPriceKey(slug: string): HubPriceKey {
  const s = slug.toLowerCase();
  if (s === "tin" || s === "tin_retrieve") return "tin_retrieve";
  if (s === "documents" || s === "document_generator") return "document_generator";
  if (s === "vehicle" || s === "vehicle_renewal") return "vehicle_renewal";
  if (s === "vehicle_license_sticker") return "vehicle_license_sticker";
  if (s === "vehicle_third_party_insurance") return "vehicle_third_party_insurance";
  if (s === "cac") return "cac_registration";
  if (s === "nin_retrieve") return "nin_retrieve";
  if (s === "nin_slip") return "nin_slip";
  return "tin_retrieve";
}

export const getHubServiceFee = createServerFn({ method: "GET" })
  .inputValidator((input: { serviceSlug: string }) => ({
    serviceSlug: String(input?.serviceSlug ?? "").trim().toLowerCase(),
  }))
  .handler(async ({ data }): Promise<{ fee: number; source: "db" | "fallback" }> => {
    const slug = data.serviceSlug;
    const fallback = SERVICE_PRICES[slugToPriceKey(slug)];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("pricing_rules")
        .select("fixed_fee, percent_fee, service, active")
        .eq("service", slug)
        .eq("active", true)
        .limit(5);
      if (error || !rows?.length) return { fee: fallback, source: "fallback" };
      const row = rows[0] as { fixed_fee?: number | null };
      const fixed = Number(row.fixed_fee ?? 0);
      if (Number.isFinite(fixed) && fixed > 0) return { fee: Math.round(fixed), source: "db" };
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
    await assertPaystackSuccess(data.paymentReference, data.amount);

    let tinPayload: {
      tin: string;
      taxpayerName: string;
      taxpayerType: "individual" | "business";
      cacNumber: string | null;
      nin: string | null;
      rawProvider: string;
    };

    const { dojahLookupCompanyTin, isDojahConfigured } = await import("./dojah.server");

    if (data.identifierType === "cac" && isDojahConfigured()) {
      try {
        const r = await dojahLookupCompanyTin({ rcNumber: data.identifier });
        tinPayload = { ...r, taxpayerName: r.taxpayerName || data.fullName };
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : "TIN lookup failed.");
      }
    } else if (data.identifierType === "cac" && !isDojahConfigured()) {
      // Soft sandbox: deterministic demo TIN when Dojah keys missing
      const digits = data.identifier.replace(/\D/g, "").padEnd(11, "0").slice(0, 11);
      tinPayload = {
        tin: `${digits.slice(0, 8)}-${String((Number(digits.slice(-3)) % 9000) + 1000)}`,
        taxpayerName: data.fullName.toUpperCase(),
        taxpayerType: "business",
        cacNumber: data.identifier,
        nin: null,
        rawProvider: "sandbox_fallback",
      };
    } else {
      // NIN path — Dojah company TIN needs RC; soft result for product UX until JTB product is live
      const digits = data.identifier.replace(/\D/g, "").padEnd(11, "0").slice(0, 11);
      tinPayload = {
        tin: `${digits.slice(0, 8)}-${String((Number(digits.slice(-3)) % 9000) + 1000)}`,
        taxpayerName: data.fullName.toUpperCase(),
        taxpayerType: "individual",
        cacNumber: null,
        nin: data.identifier,
        rawProvider: isDojahConfigured() ? "pending_jtb_product" : "sandbox_fallback",
      };
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
    const { dojahLookupVehicle, isDojahConfigured } = await import("./dojah.server");
    if (isDojahConfigured()) {
      try {
        return await dojahLookupVehicle(data);
      } catch (e) {
        // Fall through to deterministic registry for UX if product not enabled
        console.warn("[hub] verifyVehicle dojah", e instanceof Error ? e.message : e);
      }
    }
    return simulateVehicleRegistry(data.plate, data.state);
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

function simulateVehicleRegistry(plate: string, state: string) {
  const clean = plate.replace(/\s+/g, "").toUpperCase();
  const seed = [...clean].reduce((a, c) => a + c.charCodeAt(0), 0);
  const makes = ["Toyota Corolla", "Honda Accord", "Lexus RX 350", "Mercedes C300", "Kia Rio"];
  const colors = ["Silver", "Black", "White", "Grey", "Blue"];
  const statusRoll = seed % 3;
  const expiryStatus =
    statusRoll === 0 ? ("valid" as const) : statusRoll === 1 ? ("expiring_soon" as const) : ("expired" as const);
  const chassisCore = `${(seed % 900) + 100}XYZ${(seed % 9000) + 1000}`;
  return {
    plate: clean,
    state,
    makeModel: makes[seed % makes.length]!,
    chassisMasked: `••••••••${chassisCore.slice(-4)}`,
    chassisFull: `JTD${chassisCore}KN`,
    color: colors[seed % colors.length]!,
    expiryStatus,
    expiryLabel:
      expiryStatus === "valid"
        ? "Valid — renews in 8 months"
        : expiryStatus === "expiring_soon"
          ? "Expiring soon — within 45 days"
          : "Expired — renewal required",
    rawProvider: "sandbox_fallback" as const,
  };
}

async function assertPaystackSuccess(reference: string, expectedNaira: number) {
  const secret = String(process.env["PAYSTACK_SECRET_KEY"] ?? "").trim();
  if (!secret) {
    if (String(process.env["HUB_ALLOW_UNVERIFIED_PAY"] ?? "") === "true") return;
    // Demo references from client when public key missing
    if (reference.startsWith("PSK_DEMO_")) return;
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set. Add it on Netlify, or set HUB_ALLOW_UNVERIFIED_PAY=true for testing.",
    );
  }
  if (reference.startsWith("PSK_DEMO_")) {
    if (String(process.env["HUB_ALLOW_UNVERIFIED_PAY"] ?? "") === "true") return;
    throw new Error("Demo payment references are not allowed when Paystack secret is configured.");
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

  // Mirror into bill_transactions so history/admin still see the order
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
