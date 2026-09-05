/**
 * Multi-vendor bill routing: VTpass primary → VTUAfrica fallback.
 * Never throws if at least one vendor returns a structured result.
 */
import { mapVtpassOutcome, vtpassPay, type VtpassPayResult } from "./vtpass.server";
import {
  isVtuafricaConfigured,
  vtuafricaPayCable,
  vtuafricaPayElectricity,
  type VtuafricaPayResult,
} from "./vtuafrica.server";

export type RoutedPayResult = {
  vendor: "vtpass" | "vtuafrica";
  status: "successful" | "pending" | "failed";
  code: string;
  responseDescription: string;
  requestId: string;
  transactionId: string | null;
  purchasedCode: string | null;
  contentStatus: string | null;
  totalAmount: number | null;
  commission: number | null;
  raw: unknown;
  fallbackUsed: boolean;
};

/** Shape expected by settleBillPurchase / existing callers */
export function toVtpassShape(r: RoutedPayResult): VtpassPayResult {
  return {
    code: r.code,
    responseDescription: r.responseDescription,
    requestId: r.requestId,
    transactionId: r.transactionId,
    contentStatus: r.contentStatus ?? r.status,
    purchasedCode: r.purchasedCode,
    totalAmount: r.totalAmount,
    commission: r.commission,
    raw: r.raw,
  };
}

const FAILOVER_CODES = new Set([
  "016",
  "018",
  "030",
  "034",
  "035",
  "083",
  "087",
  "091",
  "010",
  "012",
  "011",
  "099",
]);

function shouldFailoverVtpass(result: VtpassPayResult): boolean {
  const code = String(result.code ?? "").trim();
  if (FAILOVER_CODES.has(code)) return true;
  const msg = (result.responseDescription ?? "").toUpperCase();
  if (
    msg.includes("WHITELIST") ||
    msg.includes("NOT ENABLED") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("TIMEOUT") ||
    msg.includes("UNREACHABLE") ||
    msg.includes("SUSPENDED") ||
    msg.includes("INACTIVE")
  ) {
    return true;
  }
  return mapVtpassOutcome(result) === "failed";
}

function fromVtpass(result: VtpassPayResult, fallbackUsed: boolean): RoutedPayResult {
  return {
    vendor: "vtpass",
    status: mapVtpassOutcome(result),
    code: result.code,
    responseDescription: result.responseDescription,
    requestId: result.requestId,
    transactionId: result.transactionId,
    purchasedCode: result.purchasedCode,
    contentStatus: result.contentStatus,
    totalAmount: result.totalAmount,
    commission: result.commission,
    raw: result.raw,
    fallbackUsed,
  };
}

function fromVtuafrica(result: VtuafricaPayResult, requestId: string): RoutedPayResult {
  return {
    vendor: "vtuafrica",
    status: result.ok ? "successful" : "failed",
    code: result.code || (result.ok ? "000" : "016"),
    responseDescription: result.message,
    requestId,
    transactionId: result.transactionId,
    purchasedCode: result.token,
    contentStatus: result.ok ? "delivered" : "failed",
    totalAmount: null,
    commission: null,
    raw: result.raw,
    fallbackUsed: true,
  };
}

async function tryVtpass(body: Record<string, unknown>): Promise<VtpassPayResult | null> {
  try {
    const { getVtpassConfig } = await import("./vtpass.server");
    getVtpassConfig();
    return await vtpassPay(body);
  } catch (e) {
    console.error("[vendor-router] VTpass call failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function routeElectricityPay(input: {
  request_id: string;
  serviceID: string;
  billersCode: string;
  meterType: string;
  amount: number;
  phone: string;
}): Promise<RoutedPayResult> {
  const primary = await tryVtpass({
    request_id: input.request_id,
    serviceID: input.serviceID,
    billersCode: input.billersCode,
    variation_code: input.meterType,
    type: input.meterType,
    amount: input.amount,
    phone: input.phone,
  });

  if (primary) {
    const outcome = mapVtpassOutcome(primary);
    if (outcome === "successful" || outcome === "pending") {
      return fromVtpass(primary, false);
    }
    if (!shouldFailoverVtpass(primary) || !isVtuafricaConfigured()) {
      return fromVtpass(primary, false);
    }
  } else if (!isVtuafricaConfigured()) {
    throw new Error(
      "Bill provider is temporarily unavailable. Try again in a moment or contact Care.",
    );
  }

  const ref = `${input.request_id}-va`.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
  try {
    const secondary = await vtuafricaPayElectricity({
      serviceID: input.serviceID,
      meterNo: input.billersCode,
      meterType: input.meterType,
      amount: input.amount,
      ref,
    });
    return fromVtuafrica(secondary, input.request_id);
  } catch (e) {
    console.error("[vendor-router] VTUAfrica electricity error", e);
    if (primary) return fromVtpass(primary, true);
    throw new Error(
      "Both bill providers failed. Please try again later or open Care with your details.",
    );
  }
}

export async function routeCablePay(input: {
  request_id: string;
  serviceID: string;
  billersCode: string;
  variation_code: string;
  amount: number;
  phone: string;
  subscription_type?: string;
}): Promise<RoutedPayResult> {
  const primary = await tryVtpass({
    request_id: input.request_id,
    serviceID: input.serviceID,
    billersCode: input.billersCode,
    variation_code: input.variation_code,
    amount: input.amount,
    phone: input.phone,
    subscription_type: input.subscription_type,
  });

  if (primary) {
    const outcome = mapVtpassOutcome(primary);
    if (outcome === "successful" || outcome === "pending") {
      return fromVtpass(primary, false);
    }
    if (!shouldFailoverVtpass(primary) || !isVtuafricaConfigured()) {
      return fromVtpass(primary, false);
    }
  } else if (!isVtuafricaConfigured()) {
    throw new Error(
      "Bill provider is temporarily unavailable. Try again in a moment or contact Care.",
    );
  }

  const ref = `${input.request_id}-va`.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
  try {
    const secondary = await vtuafricaPayCable({
      serviceID: input.serviceID,
      smartcard: input.billersCode,
      amount: input.amount,
      ref,
      variation: input.variation_code,
    });
    return fromVtuafrica(secondary, input.request_id);
  } catch (e) {
    console.error("[vendor-router] VTUAfrica cable error", e);
    if (primary) return fromVtpass(primary, true);
    throw new Error(
      "Both bill providers failed. Please try again later or open Care with your details.",
    );
  }
}
