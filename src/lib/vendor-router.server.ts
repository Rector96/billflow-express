/**
 * Multi-vendor bill routing: VTpass primary → VTUAfrica fallback.
 *
 * SAFETY RULE:
 * A fallback provider may only be used after VTpass gives a DEFINITIVE failure.
 * A timeout, network error, 5xx, or other ambiguous result is NOT a failure.
 * VTpass may have accepted/processed the transaction even when our request did
 * not receive a response. Sending the same transaction to another provider in
 * that situation can double-fulfil a customer's bill.
 *
 * Requery remains the correct recovery path for an ambiguous VTpass transaction.
 * This router therefore never falls back when the primary call itself throws.
 */
import { mapVtpassOutcome, vtpassPay, type VtpassPayResult } from "./vtpass.server";
import {
  vtuafricaPayCable,
  vtuafricaPayElectricity,
  type VtuafricaPayResult,
} from "./vtuafrica.server";

function isVtuafricaEnabled(): boolean {
  return (
    process.env["VTUAFRICA_ENABLED"]?.trim().toLowerCase() === "true" &&
    Boolean((process.env["VTUAFRICA_API_KEY"] ?? "").trim())
  );
}

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

function parseMoney(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const n = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function extractEconomics(raw: unknown): { totalAmount: number | null; commission: number | null } {
  const root = (raw ?? {}) as Record<string, unknown>;
  const content = (root["content"] ?? {}) as Record<string, unknown>;
  const tx = (content["transactions"] ?? {}) as Record<string, unknown>;
  return {
    totalAmount: parseMoney(tx["total_amount"]),
    commission: parseMoney(tx["commission"]),
  };
}

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

/**
 * These are provider responses that represent a concrete inability to fulfil
 * the request. They are intentionally narrower than transport errors.
 */
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
]);

export function shouldFailoverVtpass(result: VtpassPayResult): boolean {
  const code = String(result.code ?? "").trim();
  if (FAILOVER_CODES.has(code)) return true;

  const msg = (result.responseDescription ?? "").toUpperCase();
  // Only provider responses that explicitly say the service/account is
  // unavailable are eligible. Transport timeouts are handled separately.
  if (
    msg.includes("WHITELIST") ||
    msg.includes("NOT ENABLED") ||
    msg.includes("SUSPENDED") ||
    msg.includes("INACTIVE")
  ) {
    return true;
  }
  return false;
}

function fromVtpass(result: VtpassPayResult, fallbackUsed: boolean): RoutedPayResult {
  const economics = extractEconomics(result.raw);
  return {
    vendor: "vtpass",
    status: mapVtpassOutcome(result),
    code: result.code,
    responseDescription: result.responseDescription,
    requestId: result.requestId,
    transactionId: result.transactionId,
    purchasedCode: result.purchasedCode,
    contentStatus: result.contentStatus,
    totalAmount: result.totalAmount ?? economics.totalAmount,
    commission: result.commission ?? economics.commission,
    raw: result.raw,
    fallbackUsed,
  };
}

function fromVtuafrica(result: VtuafricaPayResult, requestId: string): RoutedPayResult {
  return {
    vendor: "vtuafrica",
    status: result.status,
    code:
      result.code ||
      (result.status === "successful" ? "000" : result.status === "pending" ? "099" : "016"),
    responseDescription: result.message,
    requestId,
    transactionId: result.transactionId,
    purchasedCode: result.token,
    contentStatus:
      result.status === "successful"
        ? "delivered"
        : result.status === "pending"
          ? "pending"
          : "failed",
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
    // A thrown provider call is intentionally converted to null so callers can
    // distinguish a transport/unknown outcome from a provider's explicit
    // definitive failure response. NEVER use this null result to fail over.
    console.error("[vendor-router] VTpass transport/config error", e instanceof Error ? e.message : e);
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

  if (!primary) {
    // IMPORTANT: VTpass may have processed the request before the network failed.
    // Do not send the same order to VTUAfrica. Persist/return an ambiguous state
    // and let the normal requery/reconciliation path determine the final result.
    throw new Error(
      "Primary bill provider did not return a definitive result. Your payment is protected; please check the transaction status before retrying.",
    );
  }

  const outcome = mapVtpassOutcome(primary);
  if (outcome === "successful" || outcome === "pending") {
    return fromVtpass(primary, false);
  }

  if (!shouldFailoverVtpass(primary) || !isVtuafricaEnabled()) {
    return fromVtpass(primary, false);
  }

  // At this point VTpass has returned a definitive failure, so (and only so)
  // the secondary provider is allowed to attempt the transaction.
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
    return fromVtpass(primary, true);
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

  if (!primary) {
    // Same safety rule as electricity: never fail over an ambiguous VTpass
    // transport result because doing so can create a duplicate fulfilment.
    throw new Error(
      "Primary bill provider did not return a definitive result. Your payment is protected; please check the transaction status before retrying.",
    );
  }

  const outcome = mapVtpassOutcome(primary);
  if (outcome === "successful" || outcome === "pending") {
    return fromVtpass(primary, false);
  }

  if (!shouldFailoverVtpass(primary) || !isVtuafricaEnabled()) {
    return fromVtpass(primary, false);
  }

  // Only a definitive VTpass failure reaches this secondary-provider path.
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
    return fromVtpass(primary, true);
  }
}
