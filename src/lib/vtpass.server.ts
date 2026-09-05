import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VtpassMode = "sandbox" | "live";

export type VtpassPayResult = {
  code: string;
  responseDescription: string;
  requestId: string;
  transactionId: string | null;
  contentStatus: string | null;
  purchasedCode: string | null;
  raw: unknown;
};

export type VtpassService = {
  serviceID: string;
  name: string;
  minimumAmount: number | null;
  maximumAmount: number | null;
  productType: string | null;
  image: string | null;
};

export type VtpassVariation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

export type VtpassVerifyResult = {
  ok: boolean;
  code: string;
  customerName: string | null;
  address: string | null;
  status: string | null;
  dueDate: string | null;
  customerNumber: string | null;
  minPurchaseAmount: number | null;
  tariff: string | null;
  meterNumber: string | null;
  raw: Record<string, unknown>;
  message: string;
};

// VTpass purchase/requery codes that represent a definitive failure.
// Any undocumented/ambiguous response remains pending and is requeryable.
const FAIL_CODES = new Set([
  "010", // variation code does not exist
  "011", // invalid arguments
  "012", // product does not exist
  "013", // below minimum amount
  "014", // duplicate request id
  "016", // transaction failed
  "017", // above maximum amount
  "018", // low wallet balance at provider
  "019",
  "021",
  "022",
  "023",
  "024",
  "027",
  "028",
  "030", // biller/provider unreachable
  "031",
  "032", // quantity limit
  "034", // service suspended
  "035", // service inactive
  "040", // transaction reversal
  "083", // system error
  "087", // invalid credentials
  "091", // transaction not processed
]);

/** Mobile data serviceIDs we surface in RockPay (excludes Smile/Spectranet for V1). */
export const MOBILE_DATA_SERVICE_IDS = new Set([
  "mtn-data",
  "airtel-data",
  "glo-data",
  "etisalat-data",
]);

/** In-memory catalogue cache (server process). */
const catalogueCache = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  const hit = catalogueCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    catalogueCache.delete(key);
    return null;
  }
  return hit.data as T;
}

function cacheSet(key: string, data: unknown) {
  catalogueCache.set(key, { at: Date.now(), data });
}

export function toVtpassServiceId(provider: string): string {
  const p = provider.trim().toLowerCase();
  if (p.includes("dstv")) return "dstv";
  if (p.includes("gotv")) return "gotv";
  if (p.includes("startimes") || p.includes("startime")) return "startimes";
  return p;
}

export function toVtpassDataServiceId(provider: string): string {
  const p = provider.trim().toLowerCase().replace(/\s+/g, "-");
  if (p === "mtn" || p === "mtn-data") return "mtn-data";
  if (p === "airtel" || p === "airtel-data") return "airtel-data";
  if (p === "glo" || p === "glo-data") return "glo-data";
  if (p === "9mobile" || p === "etisalat" || p === "etisalat-data") return "etisalat-data";
  if (MOBILE_DATA_SERVICE_IDS.has(p)) return p;
  throw new Error("unsupported_network");
}

export function toVtpassAirtimeServiceId(provider: string): string {
  const p = provider.trim().toLowerCase();
  if (p === "mtn") return "mtn";
  if (p === "glo") return "glo";
  if (p === "airtel") return "airtel";
  if (p === "9mobile" || p === "etisalat") return "etisalat";
  throw new Error("unsupported_network");
}

export function getVtpassConfig(): {
  mode: VtpassMode;
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  publicKey: string;
} {
  const mode = (process.env["VTPASS_MODE"] ?? "sandbox").trim().toLowerCase() as VtpassMode;
  const isLive = mode === "live";

  const defaultUrl = isLive
    ? "https://api-service.vtpass.com/api"
    : "https://sandbox.vtpass.com/api";

  const baseUrl = (process.env["VTPASS_BASE_URL"] ?? defaultUrl).trim().replace(/\/$/, "");

  const apiKey = (process.env["VTPASS_API_KEY"] ?? "").trim();
  const secretKey = (process.env["VTPASS_SECRET_KEY"] ?? "").trim();
  const publicKey = (process.env["VTPASS_PUBLIC_KEY"] ?? "").trim();

  if (!apiKey || !secretKey) {
    throw new Error(
      `VTpass is not configured. Set VTPASS_API_KEY and VTPASS_SECRET_KEY (${isLive ? "live" : "sandbox"}) on the host.`,
    );
  }

  return { mode: isLive ? "live" : "sandbox", baseUrl, apiKey, secretKey, publicKey };
}

function headersForPost(): HeadersInit {
  const { apiKey, secretKey } = getVtpassConfig();
  return {
    "Content-Type": "application/json",
    "api-key": apiKey,
    "secret-key": secretKey,
  };
}

function headersForGet(): HeadersInit {
  const { apiKey, publicKey, secretKey } = getVtpassConfig();
  return {
    "Content-Type": "application/json",
    "api-key": apiKey,
    ...(publicKey ? { "public-key": publicKey } : { "secret-key": secretKey }),
  };
}

export function normalizeNgPhone(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("234") && d.length === 13) d = `0${d.slice(3)}`;
  if (d.length === 10 && /^[789]/.test(d)) d = `0${d}`;
  if (!/^0[789][01]\d{8}$/.test(d)) {
    throw new Error("Enter a valid Nigerian mobile number.");
  }
  return d;
}

/**
 * Provider GET wrapper. Provider/network failures must never leak as a raw
 * browser "Failed to fetch" error. HTTP failures are treated as provider
 * errors and surfaced with a stable RockPay message.
 */
async function vtpassGetJson(path: string): Promise<unknown> {
  const { baseUrl } = getVtpassConfig();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: headersForGet(),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    console.error("[VTpass] GET network error", path, err);
    throw new Error("VTpass is temporarily unavailable. Please try again.");
  }

  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("[VTpass] GET HTTP error", res.status, path, raw);
    throw new Error("VTpass is temporarily unavailable. Please try again.");
  }

  return raw ?? {};
}

export async function vtpassListServices(identifier: string): Promise<VtpassService[]> {
  const key = `services:${identifier}`;
  const cached = cacheGet<VtpassService[]>(key);
  if (cached) return cached;

  const raw = (await vtpassGetJson(`/services?identifier=${encodeURIComponent(identifier)}`)) as {
    content?: unknown;
  };
  const list = Array.isArray(raw.content) ? raw.content : [];
  let mapped: VtpassService[] = list
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        serviceID: String(r["serviceID"] ?? ""),
        name: String(r["name"] ?? r["serviceID"] ?? ""),
        minimumAmount: r["minimium_amount"] != null ? Number(r["minimium_amount"]) : null,
        maximumAmount: r["maximum_amount"] != null ? Number(r["maximum_amount"]) : null,
        productType: r["product_type"] != null ? String(r["product_type"]) : null,
        image: r["image"] != null ? String(r["image"]) : null,
      };
    })
    .filter((s) => s.serviceID);

  if (identifier === "data") {
    const mobile = mapped.filter((s) => MOBILE_DATA_SERVICE_IDS.has(s.serviceID));
    if (mobile.length) mapped = mobile;
  }

  if (!mapped.length) {
    throw new Error("Service information is temporarily unavailable. Please try again.");
  }
  cacheSet(key, mapped);
  return mapped;
}

export async function vtpassListVariations(serviceID: string): Promise<VtpassVariation[]> {
  const key = `variations:${serviceID}`;
  const cached = cacheGet<VtpassVariation[]>(key);
  if (cached) return cached;

  const raw = (await vtpassGetJson(
    `/service-variations?serviceID=${encodeURIComponent(serviceID)}`,
  )) as { content?: { variations?: unknown } };
  const variations = Array.isArray(raw.content?.variations) ? raw.content!.variations! : [];
  const mapped: VtpassVariation[] = variations
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        variationCode: String(r["variation_code"] ?? ""),
        name: String(r["name"] ?? ""),
        amount: Number(r["variation_amount"] ?? 0),
        fixedPrice: String(r["fixedPrice"] ?? "Yes").toLowerCase() === "yes",
      };
    })
    .filter((v) => v.variationCode && Number.isFinite(v.amount) && v.amount >= 0);

  if (!mapped.length) {
    throw new Error("No plans are currently available for this provider. Please try again later.");
  }
  cacheSet(key, mapped);
  return mapped;
}

export async function vtpassMerchantVerify(input: {
  serviceID: string;
  billersCode: string;
  type?: string | undefined;
}): Promise<VtpassVerifyResult> {
  const { baseUrl } = getVtpassConfig();
  const body: Record<string, string> = {
    serviceID: input.serviceID,
    billersCode: input.billersCode,
  };
  if (input.type) body["type"] = input.type;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/merchant-verify`, {
      method: "POST",
      headers: headersForPost(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error("[VTpass] merchant verify network error", input.serviceID, err);
    return {
      ok: false,
      code: "TIMEOUT",
      customerName: null,
      address: null,
      status: null,
      dueDate: null,
      customerNumber: null,
      minPurchaseAmount: null,
      tariff: null,
      meterNumber: null,
      raw: {},
      message: "VTpass is temporarily unavailable. Please try again.",
    };
  }

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    console.error("[VTpass] merchant verify HTTP error", res.status, input.serviceID, raw);
    return {
      ok: false,
      code: String(raw["code"] ?? res.status),
      customerName: null,
      address: null,
      status: null,
      dueDate: null,
      customerNumber: null,
      minPurchaseAmount: null,
      tariff: null,
      meterNumber: null,
      raw,
      message: "VTpass is temporarily unavailable. Please try again.",
    };
  }

  const code = String(raw["code"] ?? "");
  const content = (raw["content"] ?? {}) as Record<string, unknown>;

  const pickStr = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = content[k] ?? raw[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return null;
  };

  const wrongBiller =
    content["WrongBillersCode"] === true ||
    content["WrongBillersCode"] === "true" ||
    content["wrongBillersCode"] === true;

  const ok = (code === "000" || code === "020") && !wrongBiller;

  const minRaw =
    content["Min_Purchase_Amount"] ?? content["min_purchase_amount"] ?? content["Minimum_Amount"];

  return {
    ok,
    code,
    customerName: pickStr(
      "Customer_Name",
      "customer_name",
      "CustomerName",
      "customerName",
      "Name",
      "name",
    ),
    address: pickStr("Address", "address", "Customer_Address", "customer_address"),
    status: pickStr("Status", "status"),
    dueDate: pickStr("Due_Date", "due_date", "DueDate"),
    customerNumber: pickStr("Customer_Number", "customer_number", "CustomerNumber"),
    minPurchaseAmount: minRaw != null && Number.isFinite(Number(minRaw)) ? Number(minRaw) : null,
    tariff: pickStr("Tariff", "tariff"),
    meterNumber: pickStr("Meter_Number", "meter_number", "MeterNumber", "meterNumber"),
    raw: content,
    message: ok
      ? "Verified"
      : String(
          raw["response_description"] ??
            content["error"] ??
            "Could not verify this number. Check and try again.",
        ),
  };
}

function parsePayResponse(
  raw: Record<string, unknown>,
  fallbackRequestId: string,
): VtpassPayResult {
  const code = String(raw["code"] ?? "");
  const content = (raw["content"] ?? {}) as Record<string, unknown>;
  const tx = (content["transactions"] ?? {}) as Record<string, unknown>;
  const purchased =
    raw["purchased_code"] != null && String(raw["purchased_code"]).trim()
      ? String(raw["purchased_code"])
      : tx["purchased_code"] != null && String(tx["purchased_code"]).trim()
        ? String(tx["purchased_code"])
        : content["purchased_code"] != null && String(content["purchased_code"]).trim()
          ? String(content["purchased_code"])
          : null;

  const statusRaw = tx["status"] ?? content["status"] ?? raw["status"] ?? null;
  const contentStatus =
    statusRaw != null && String(statusRaw).trim() ? String(statusRaw).toLowerCase().trim() : null;

  const transactionId =
    tx["transactionId"] != null
      ? String(tx["transactionId"])
      : content["transactionId"] != null
        ? String(content["transactionId"])
        : raw["transactionId"] != null
          ? String(raw["transactionId"])
          : null;

  return {
    code,
    responseDescription: String(
      raw["response_description"] ?? content["response_description"] ?? "",
    ),
    requestId: String(raw["requestId"] ?? raw["request_id"] ?? fallbackRequestId),
    transactionId,
    contentStatus,
    purchasedCode: purchased,
    raw,
  };
}

export async function vtpassPayAirtime(input: {
  serviceId: string;
  phone: string;
  amount: number;
  requestId: string;
}): Promise<VtpassPayResult> {
  const { baseUrl } = getVtpassConfig();
  const body = {
    request_id: input.requestId,
    serviceID: input.serviceId,
    amount: input.amount,
    phone: input.phone,
  };
  try {
    const res = await fetch(`${baseUrl}/pay`, {
      method: "POST",
      headers: headersForPost(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.error("[VTpass] airtime HTTP error", res.status, input.requestId, raw);
      return {
        code: String(raw["code"] ?? res.status),
        responseDescription: String(raw["response_description"] ?? "Provider request failed"),
        requestId: input.requestId,
        transactionId: null,
        contentStatus: null,
        purchasedCode: null,
        raw,
      };
    }
    return parsePayResponse(raw, input.requestId);
  } catch (err) {
    console.error("[VTpass] airtime network error", input.requestId, err);
    return {
      code: "TIMEOUT",
      responseDescription: "Provider timeout",
      requestId: input.requestId,
      transactionId: null,
      contentStatus: null,
      purchasedCode: null,
      raw: { error: String(err) },
    };
  }
}

/** Generic pay for cable / electricity / data. */
export async function vtpassPay(body: Record<string, unknown>): Promise<VtpassPayResult> {
  const { baseUrl } = getVtpassConfig();
  const requestId = String(body["request_id"] ?? "");
  try {
    const res = await fetch(`${baseUrl}/pay`, {
      method: "POST",
      headers: headersForPost(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.error("[VTpass] pay HTTP error", res.status, requestId, raw);
      return {
        code: String(raw["code"] ?? res.status),
        responseDescription: String(raw["response_description"] ?? "Provider request failed"),
        requestId,
        transactionId: null,
        contentStatus: null,
        purchasedCode: null,
        raw,
      };
    }
    return parsePayResponse(raw, requestId);
  } catch (err) {
    console.error("[VTpass] pay network error", requestId, err);
    return {
      code: "TIMEOUT",
      responseDescription: "Provider timeout",
      requestId,
      transactionId: null,
      contentStatus: null,
      purchasedCode: null,
      raw: { error: String(err) },
    };
  }
}

export async function vtpassRequery(requestId: string): Promise<VtpassPayResult> {
  const { baseUrl } = getVtpassConfig();
  try {
    const res = await fetch(`${baseUrl}/requery`, {
      method: "POST",
      headers: headersForPost(),
      body: JSON.stringify({ request_id: requestId }),
      signal: AbortSignal.timeout(45_000),
    });
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.error("[VTpass] requery HTTP error", res.status, requestId, raw);
      return {
        code: String(raw["code"] ?? res.status),
        responseDescription: String(raw["response_description"] ?? "Provider requery failed"),
        requestId,
        transactionId: null,
        contentStatus: null,
        purchasedCode: null,
        raw,
      };
    }
    return parsePayResponse(raw, requestId);
  } catch (err) {
    console.error("[VTpass] requery network error", requestId, err);
    return {
      code: "TIMEOUT",
      responseDescription: "Provider timeout",
      requestId,
      transactionId: null,
      contentStatus: null,
      purchasedCode: null,
      raw: { error: String(err) },
    };
  }
}

/** Map VTpass response → RockPay outcome (never trust the browser). */
export function mapVtpassOutcome(result: VtpassPayResult): "successful" | "failed" | "pending" {
  // A network timeout/no response is ambiguous. Never refund based only on
  // the timeout; leave the ledger pending so the request can be requeried.
  if (result.code === "TIMEOUT" || result.code === "") return "pending";
  if (result.code === "099") return "pending";
  if (FAIL_CODES.has(result.code)) return "failed";

  // VTpass documents 000 as "processed". The transaction status inside the
  // response determines whether the provider actually delivered the service.
  if (result.code === "000") {
    const s = (result.contentStatus ?? "").toLowerCase().trim();
    if (s === "delivered" || s === "successful" || s === "success") return "successful";
    if (s === "failed" || s === "reversed" || s === "refunded") return "failed";
    return "pending";
  }

  // 020 is a verification response code, not a purchase success code.
  // For purchase/requery responses, anything not explicitly documented as
  // successful or failed is ambiguous and must remain pending for requery.
  return "pending";
}
