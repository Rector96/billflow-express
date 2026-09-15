/**
 * Hub production server functions (TanStack Start).
 * Equivalent to POST /api/v1/recover-tin and POST /api/v1/verify-vehicle.
 * Secrets: DOJAH_*, PAYSTACK_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY — server only.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RecoverTinSuccess, GenerateDocumentSuccess } from "@/lib/hub-api.types";
import { SERVICE_PRICES, type HubPriceKey } from "@/lib/hub-service-prices";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Map hub slug → fee from pricing_rules or static fallback. */
export const getHubServiceFee = createServerFn({ method: "GET" })
  .inputValidator((input: { serviceSlug: string }) => ({
    serviceSlug: String(input?.serviceSlug ?? "").trim().toLowerCase(),
  }))
  .handler(async ({ data }): Promise<{ fee: number; source: "db" | "fallback" }> => {
    const slug = data.serviceSlug;
    const fallbackKey = slugToPriceKey(slug);
    const fallback = SERVICE_PRICES[fallbackKey];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("pricing_rules")
        .select("fixed_fee, percent_fee, service, active")
        .eq("service", slug)
        .eq("active", true)
        .limit(5);
      if (error || !rows?.length) return { fee: fallback, source: "fallback" };
      const row = rows[0] as { fixed_fee?: number | null; percent_fee?: number | null };
      const fixed = Number(row.fixed_fee ?? 0);
      if (Number.isFinite(fixed) && fixed > 0) return { fee: Math.round(fixed), source: "db" };
      return { fee: fallback, source: "fallback" };
    } catch {
      return { fee: fallback, source: "fallback" };
    }
  });

function slugToPriceKey(slug: string): HubPriceKey {
  if (slug === "tin" || slug === "tin_retrieve") return "tin_retrieve";
  if (slug === "documents" || slug === "document_generator") return "document_generator";
  if (slug === "vehicle" || slug === "vehicle_renewal") return "vehicle_renewal";
  if (slug === "cac") return "cac_registration";
  if (slug === "nin_retrieve") return "nin_retrieve";
  return "tin_retrieve";
}

/** POST /api/v1/recover-tin equivalent */
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

    try {
      const { dojahLookupCompanyTin, isDojahConfigured } = await import("./dojah.server");
      if (!isDojahConfigured()) {
        throw new Error("Dojah is not configured on the server.");
      }
      if (data.identifierType === "cac") {
        const r = await dojahLookupCompanyTin({ rcNumber: data.identifier });
        tinPayload = { ...r, taxpayerName: r.taxpayerName || data.fullName };
      } else {
        // Individual TIN is not exposed the same way on Dojah; company TIN requires RC.
        throw new Error(
          "TIN retrieval via Dojah currently supports CAC / RC numbers. Use a company RC number, or enable your JTB product.",
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "TIN lookup failed.";
      throw new Error(msg);
    }

    await logHubTransaction({
      userId: context.userId,
      service: "tin",
      amount: data.amount,
      reference: data.paymentReference,
      status: "successful",
      metadata: {
        tin: tinPayload.tin,
        taxpayerName: tinPayload.taxpayerName,
        identifier: data.identifier,
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
        requestId: uid("tin"),
        fee: data.amount,
      },
    };
  });

/** POST /api/v1/verify-vehicle equivalent */
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
    if (!isDojahConfigured()) {
      throw new Error("Dojah is not configured on the server.");
    }
    return dojahLookupVehicle(data);
  });

/** After Paystack success — persist hub transaction row. */
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
      metadata: (input?.metadata && typeof input.metadata === "object" ? input.metadata : {}) as Record<
        string,
        unknown
      >,
    }),
  )
  .handler(async ({ data, context }) => {
    await assertPaystackSuccess(data.paymentReference, data.amount);
    await logHubTransaction({
      userId: context.userId,
      service: data.service,
      amount: data.amount,
      reference: data.paymentReference,
      status: "successful",
      metadata: data.metadata,
    });
    return { ok: true as const, reference: data.paymentReference };
  });

async function assertPaystackSuccess(reference: string, expectedNaira: number) {
  const secret = String(process.env["PAYSTACK_SECRET_KEY"] ?? "").trim();
  if (!secret) {
    // Allow sandbox UI without secret only when explicitly enabled
    if (String(process.env["HUB_ALLOW_UNVERIFIED_PAY"] ?? "") === "true") return;
    throw new Error("PAYSTACK_SECRET_KEY is not set on the server.");
  }
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
  });
  const json = (await res.json()) as {
    status?: boolean;
    data?: { status?: string; amount?: number; currency?: string };
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

async function logHubTransaction(input: {
  userId: string;
  service: string;
  amount: number;
  reference: string;
  status: string;
  metadata: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Prefer bill_transactions if present; fall back silently if schema differs
    const { error } = await supabaseAdmin.from("bill_transactions").insert({
      user_id: input.userId,
      service: input.service,
      amount: input.amount,
      status: input.status,
      internal_reference: input.reference,
      provider_request_id: input.reference,
      metadata: {
        channel: "hub",
        ...input.metadata,
      },
    } as never);
    if (error) {
      console.warn("[hub] bill_transactions insert", error.message);
      // Optional alternate table name from product brief
      await supabaseAdmin.from("user_transactions").insert({
        user_id: input.userId,
        service: input.service,
        amount: input.amount,
        status: input.status === "successful" ? "success" : input.status,
        reference: input.reference,
        metadata: input.metadata,
      } as never);
    }
  } catch (e) {
    console.warn("[hub] log transaction failed", e);
  }
}

export type { GenerateDocumentSuccess };
