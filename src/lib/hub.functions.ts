/**
 * Hub production server functions (TanStack Start).
 *
 * SECURITY / FULFILLMENT RULE:
 * - Payment verification happens on the server.
 * - Government/regulated services need a real provider in production (isBillLive).
 * - While HUB preview is on (default), endpoints may return synthetic demo data
 *   so UX can be tested end-to-end without Dojah. Demo is never isBillLive.
 *
 * Every paid hub order writes hub_orders and notifies staff + the customer.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RecoverTinSuccess } from "@/lib/hub-api.types";
import { notifyStaffNewHubOrder } from "@/lib/hub-documents.functions";
import { notifyUser } from "@/lib/hub-notify.server";
import { isHubPreviewServerEnabled } from "@/lib/hub-preview.server";
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
  if (s === "vehicle_license_sticker" || s === "license_sticker") return "vehicle_license_sticker";
  if (s === "vehicle_third_party_insurance" || s === "third_party_insurance")
    return "vehicle_third_party_insurance";
  if (s === "cac") return "cac_registration";
  if (s === "nin_retrieve") return "nin_retrieve";
  if (s === "nin_slip") return "nin_slip";
  if (s === "nin_card_print" || s === "nin_plastic_card") return "nin_plastic_card";
  return null;
}

/** Canonical service key for admin filters + My documents. */
function normalizeHubService(service: string): string {
  const s = service.toLowerCase().trim();
  if (s === "license_sticker") return "vehicle_license_sticker";
  if (s === "third_party_insurance") return "vehicle_third_party_insurance";
  if (s === "nin_plastic_card") return "nin_card_print";
  return s;
}

export const getHubServiceFee = createServerFn({ method: "GET" })
  .inputValidator((input: { serviceSlug: string }) => ({
    serviceSlug: String(input?.serviceSlug ?? "")
      .trim()
      .toLowerCase(),
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
      const identifier = String(input?.identifier ?? "")
        .replace(/\s/g, "")
        .trim();
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
    const live = isBillLive("tin");
    const preview = isHubPreviewServerEnabled();

    if (!live && !preview) {
      throw new Error("TIN retrieval is temporarily unavailable.");
    }

    if (!live && preview) {
      await assertPaystackSuccess(data.paymentReference, data.amount, { allowDemo: true });
      const track = uid("TIN-DEMO");
      const fakeTin = `1${data.identifier.replace(/\D/g, "").slice(-9).padStart(9, "0")}`.slice(
        0,
        10,
      );
      await logHubOrder({
        userId: context.userId,
        service: "tin",
        amount: data.amount,
        paymentReference: data.paymentReference,
        trackingReference: track,
        customerIdentifier: data.identifier,
        metadata: {
          demo: true,
          taxpayerName: data.fullName,
          tin: fakeTin,
          document_ready: true,
        },
        status: "successful",
      });
      return {
        status: "success",
        data: {
          tin: fakeTin,
          taxpayerName: data.fullName,
          taxpayerType: data.identifierType === "cac" ? "business" : "individual",
          jtbRegistered: true,
          cacNumber: data.identifierType === "cac" ? data.identifier : null,
          nin: data.identifierType === "nin" ? data.identifier : null,
          email: null,
          phone: null,
          rawProvider: "demo",
        },
        meta: {
          paymentReference: data.paymentReference,
          requestId: track,
          fee: data.amount,
        },
      };
    }

    const { dojahLookupCompanyTin, isDojahConfigured } = await import("./dojah.server");
    if (data.identifierType !== "cac" || !isDojahConfigured()) {
      throw new Error(
        "TIN retrieval is temporarily unavailable. A verified TIN provider is required before this service can be purchased.",
      );
    }

    await assertPaystackSuccess(data.paymentReference, data.amount, { allowDemo: false });

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
      status: "successful",
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
    const live = isBillLive("vehicle");
    const preview = isHubPreviewServerEnabled();

    if (!live && !preview) {
      throw new Error("Vehicle verification is temporarily unavailable.");
    }

    if (!live && preview) {
      const seed = data.plate.replace(/[^A-Z0-9]/g, "");
      const expired = seed.length % 2 === 0;
      return {
        plate: data.plate,
        state: data.state,
        makeModel: "Toyota Corolla (demo)",
        color: "Silver",
        chassisNumber: `DEMO••••${seed.slice(-4) || "0000"}`,
        expiryStatus: expired ? ("expired" as const) : ("valid" as const),
        rawProvider: "demo",
      };
    }

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
      shippingAddress?: string;
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
        shippingAddress: String(input?.shippingAddress ?? "").trim(),
      };
    },
  )
  .handler(async ({ data, context }) => {
    const live = isBillLive("vehicle");
    const preview = isHubPreviewServerEnabled();

    if (!live && !preview) {
      throw new Error("Vehicle renewal is temporarily unavailable.");
    }

    await assertPaystackSuccess(data.paymentReference, data.amount, {
      allowDemo: !live && preview,
    });

    const service =
      data.choice === "third_party_insurance"
        ? "vehicle_third_party_insurance"
        : "vehicle_license_sticker";
    const isPhysical = data.choice === "license_sticker";
    const trackingReference = `VR-${Date.now().toString(36).toUpperCase()}-${data.plate.slice(0, 6)}`;

    await logHubOrder({
      userId: context.userId,
      service,
      amount: data.amount,
      paymentReference: data.paymentReference,
      trackingReference,
      customerIdentifier: data.plate,
      status: "pending",
      metadata: {
        plate: data.plate,
        state: data.state,
        makeModel: data.makeModel,
        delivery: isPhysical ? "deliver" : "download",
        fulfillment_status: isPhysical ? "queued" : null,
        shipping_address: data.shippingAddress || null,
        demo: !live,
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
      status?: string;
    }) => ({
      service: String(input?.service ?? "").trim(),
      amount: Math.round(Number(input?.amount)),
      paymentReference: String(input?.paymentReference ?? "").trim(),
      metadata:
        input?.metadata && typeof input.metadata === "object"
          ? (input.metadata as Record<string, unknown>)
          : {},
      status: String(input?.status ?? "pending").trim() || "pending",
    }),
  )
  .handler(async ({ data, context }) => {
    if (!isBillLive(data.service) && !isHubPreviewServerEnabled()) {
      throw new Error("This service is not currently available for payment.");
    }

    await assertPaystackSuccess(data.paymentReference, data.amount, {
      allowDemo: !isBillLive(data.service) && isHubPreviewServerEnabled(),
    });
    const track = uid("HUB");
    await logHubOrder({
      userId: context.userId,
      service: data.service,
      amount: data.amount,
      paymentReference: data.paymentReference,
      trackingReference: track,
      customerIdentifier: null,
      metadata: data.metadata,
      status: data.status,
    });
    return { ok: true as const, reference: data.paymentReference, trackingReference: track };
  });

async function assertPaystackSuccess(
  reference: string,
  expectedNaira: number,
  opts?: { allowDemo?: boolean },
) {
  const secret = String(process.env["PAYSTACK_SECRET_KEY"] ?? "").trim();
  const allowUnverified =
    String(process.env["HUB_ALLOW_UNVERIFIED_PAY"] ?? "") === "true" || !!opts?.allowDemo;

  if (!secret) {
    if (allowUnverified && (reference.startsWith("PSK_DEMO_") || opts?.allowDemo)) return;
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
  status?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const service = normalizeHubService(input.service);
  const status = input.status ?? "pending";

  const { error: hubErr } = await supabaseAdmin.from("hub_orders").insert({
    user_id: input.userId,
    service,
    amount: input.amount,
    status,
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
      service,
      provider: "hub",
      product: service,
      amount: input.amount,
      customer_identifier: input.customerIdentifier,
      internal_reference: ref,
      status,
      provider_request_id: input.paymentReference,
      metadata: {
        channel: "hub",
        title: `Hub · ${service}`,
        service_slug: service,
        payment_reference: input.paymentReference,
        ...input.metadata,
      },
    } as never);
    if (error) console.warn("[hub] bill_transactions mirror", error.message);
  } catch (e) {
    console.warn("[hub] bill mirror failed", e);
  }

  // Staff + customer in-app alerts (best-effort)
  try {
    await notifyStaffNewHubOrder({
      service,
      amount: input.amount,
      orderHint: input.customerIdentifier || input.trackingReference || service,
    });
  } catch (e) {
    console.warn("[hub] staff notify", e);
  }
  try {
    await notifyUser({
      userId: input.userId,
      title: `${service.replace(/_/g, " ")} — order received`,
      message:
        status === "successful"
          ? "Your order is complete. Check Profile → My documents if a file is available."
          : "We received your payment. Staff will process it — watch Notifications for updates.",
      type: status === "successful" ? "success" : "information",
    });
  } catch (e) {
    console.warn("[hub] customer notify", e);
  }
}
