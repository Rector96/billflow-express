/**
 * Multi-vendor bill routing: VTpass primary → VTUAfrica fallback.
 * Use when VTpass is down, product not whitelisted, or definitive provider failure.
 */
import {
  mapVtpassOutcome,
  vtpassPay,
  type VtpassPayResult,
} from "./vtpass.server";
import {
  isVtuafricaConfigured,
  vtuafricaPayCable,
  vtuafricaPayElectricity,
  type VtuafricaPayResult,
} from "./vtuafrica.server";

export type RoutedPayResult = {
  vendor: "vtpass" | "vtuafrica";
  status: "successful" | "pending" | "failed";
  /** Unified fields for settlement */
  code: string;
  responseDescription: string;
  requestId: string;
  transactionId: string | null;
  purchasedCode: string | null;
  totalAmount: number | null;
  commission: number | null;
  raw: unknown;
  fallbackUsed: boolean;
};

/** VTpass outcomes that are worth trying the secondary vendor */
const FAILOVER_CODES = new Set([
  "016",
  "018", // low wallet at primary
  "030", // biller unreachable
  "034", // service suspended
  "035", // inactive
  "083",
  "087",
  "091",
  "010",
  "012", // product missing / not enabled
]);

function shouldFailoverVtpass(result: VtpassPayResult): boolean {
  const code = String(result.code ?? "").trim();
  if (FAILOVER_CODES.has(code)) return true;
  const msg = (result.responseDescription ?? "").toUpperCase();
  if (msg.includes("WHITELIST") || msg.includes("NOT ENABLED") || msg.includes("UNAVAILABLE")) {
    return true;
  }
  if (msg.includes("TIMEOUT") || msg.includes("UNREACHABLE")) return true;
  return mapVtpassOutcome(result) === "failed" && FAILOVER_CODES.has(code);
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
    code: result.code,
    responseDescription: result.message,
    requestId,
    transactionId: result.transactionId,
    purchasedCode: result.token,
    totalAmount: null,
    commission: null,
    raw: result.raw,
    fallbackUsed: true,
  };
}

export async function routeElectricityPay(input: {
  request_id: string;
  serviceID: string;
  billersCode: string;
  meterType: string;
  amount: number;
  phone: string;
}): Promise<RoutedPayResult> {
  let primary: VtpassPayResult | null = null;
  try {
    primary = await vtpassPay({
      request_id: input.request_id,
      serviceID: input.serviceID,
      billersCode: input.billersCode,
      variation_code: input.meterType,
      type: input.meterType,
      amount: input.amount,
      phone: input.phone,
    });
    const outcome = mapVtpassOutcome(primary);
    if (outcome === "successful" || outcome === "pending") {
      return fromVtpass(primary, false);
    }
    if (!shouldFailoverVtpass(primary) || !isVtuafricaConfigured()) {
      return fromVtpass(primary, false);
    }
  } catch (e) {
    console.error("[vendor-router] VTpass electricity error", e);
    if (!isVtuafricaConfigured()) throw e;
  }

  // Fallback VTUAfrica (new ref suffix so vendor sees unique id)
  const ref = `${input.request_id}-va`.slice(0, 40);
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
    throw e;
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
  let primary: VtpassPayResult | null = null;
  try {
    primary = await vtpassPay({
      request_id: input.request_id,
      serviceID: input.serviceID,
      billersCode: input.billersCode,
      variation_code: input.variation_code,
      amount: input.amount,
      phone: input.phone,
      subscription_type: input.subscription_type,
    });
    const outcome = mapVtpassOutcome(primary);
    if (outcome === "successful" || outcome === "pending") {
      return fromVtpass(primary, false);
    }
    if (!shouldFailoverVtpass(primary) || !isVtuafricaConfigured()) {
      return fromVtpass(primary, false);
    }
  } catch (e) {
    console.error("[vendor-router] VTpass cable error", e);
    if (!isVtuafricaConfigured()) throw e;
  }

  const ref = `${input.request_id}-va`.slice(0, 40);
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
    throw e;
  }
}
