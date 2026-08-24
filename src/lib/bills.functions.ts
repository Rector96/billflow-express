import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type BillPurchaseResult = {
  status: "successful" | "pending" | "failed";
  reference: string;
  requestId: string;
  providerTransactionId: string | null;
  amount: number;
  identifierMasked: string;
  provider: string;
  product: string | null;
  token: string | null;
  balanceAfter: number | null;
  message: string;
  customerName: string | null;
};

function maskId(id: string): string {
  if (id.length < 5) return "••••";
  return `••••${id.slice(-4)}`;
}

function maskPhone(phone: string): string {
  if (phone.length < 7) return "••••";
  return `${phone.slice(0, 3)}••••${phone.slice(-3)}`;
}

function safePayload(raw: unknown): Json {
  try {
    return JSON.parse(JSON.stringify(raw)) as Json;
  } catch {
    return {};
  }
}

function customerMessage(
  status: BillPurchaseResult["status"],
  slug: string,
  amount?: number,
  providerHint?: string | null,
): string {
  const label =
    slug === "cable"
      ? "Cable TV"
      : slug === "electricity"
        ? "Electricity"
        : slug === "data"
          ? "Data"
          : "Bill";

  if (status === "successful") {
    return amount != null
      ? `Your ${label} purchase of ₦${Math.round(amount).toLocaleString("en-NG")} was successful.`
      : `Your ${label} purchase was successful.`;
  }

  if (status === "failed") {
    const hint = (providerHint ?? "").trim();
    const upper = hint.toUpperCase();
    if (upper.includes("WHITELIST") || upper.includes("NOT WHITELISTED")) {
      return (
        `This ${label.toLowerCase()} product is not enabled on VTpass yet. ` +
        "Enable it under Sandbox → Product Settings, then try again. Wallet refunded."
      );
    }
    if (hint) {
      return `Your ${label} purchase failed (${hint}). Your wallet has been refunded.`;
    }
    return `Your ${label} purchase failed. Your wallet has been refunded.`;
  }

  return `Your ${label} purchase is still being confirmed. Your money is protected.`;
}

function mapStartError(message: string): Error {
  if (message.includes("insufficient_funds")) return new Error("insufficient_funds");
  if (message.includes("invalid_pin")) return new Error("invalid_pin");
  if (message.includes("pin_locked")) return new Error("pin_locked");
  if (message.includes("pin_not_set")) return new Error("pin_not_set");
  if (message.includes("invalid amount")) return new Error("Enter a valid amount.");
  if (message.includes("unsupported_service")) return new Error("This service is not available yet.");
  if (
    message.includes("invalid_phone") ||
    message.includes("Enter a valid Nigerian")
  ) {
    return new Error("Enter a valid Nigerian mobile number.");
  }

  return new Error(message);
}

export const listVtpassServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { category: string }) => {
    const category = String(input?.category ?? "").trim();
    if (
      category !== "tv-subscription" &&
      category !== "electricity-bill" &&
      category !== "data"
    ) {
      throw new Error("Unsupported catalogue category.");
    }
    return { category };
  })
  .handler(async ({ data }) => {
    const { getVtpassConfig, vtpassListServices } = await import("./vtpass.server");
    getVtpassConfig();
    const services = await vtpassListServices(data.category);
    return services.map((s) => ({
      serviceID: s.serviceID,
      name: s.name,
      minimumAmount: s.minimumAmount,
      maximumAmount: s.maximumAmount,
    }));
  });

export const listVtpassVariations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceID: string }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    if (!serviceID) throw new Error("Select a provider.");
    return { serviceID };
  })
  .handler(async ({ data }) => {
    const { getVtpassConfig, vtpassListVariations } = await import("./vtpass.server");
    getVtpassConfig();
    const variations = await vtpassListVariations(data.serviceID);
    return variations.map((v) => ({
      variationCode: v.variationCode,
      name: v.name,
      amount: v.amount,
      fixedPrice: v.fixedPrice,
    }));
  });

export const verifyVtpassCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serviceID: string;
    billersCode: string;
    type?: string;
  }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    const billersCode = String(input?.billersCode ?? "").replace(/\s/g, "");
    if (!serviceID) throw new Error("Select a provider.");
    if (!billersCode || billersCode.length < 5) {
      throw new Error("Enter a valid number.");
    }
    const type = input?.type ? String(input.type).trim().toLowerCase() : undefined;
    if (type && type !== "prepaid" && type !== "postpaid") {
      throw new Error("Select prepaid or postpaid.");
    }
    return { serviceID, billersCode, type };
  })
  .handler(async ({ data }) => {
    const { getVtpassConfig, vtpassMerchantVerify } = await import("./vtpass.server");
    getVtpassConfig();
    const result = await vtpassMerchantVerify({
      serviceID: data.serviceID,
      billersCode: data.billersCode,
      type: data.type,
    });
    if (!result.ok) {
      if (data.type === "prepaid" || data.type === "postpaid") {
        throw new Error(
          result.message ||
            "Meter verification failed. Please check the meter number and try again.",
        );
      }
      throw new Error(
        result.message || "Could not verify this number. Check and try again.",
      );
    }
    return {
      customerName: result.customerName,
      address: result.address,
      status: result.status,
      dueDate: result.dueDate,
      customerNumber: result.customerNumber,
      minPurchaseAmount: result.minPurchaseAmount,
      tariff: result.tariff,
      meterNumber: result.meterNumber,
      snapshot: safePayload(result.raw),
    };
  });
