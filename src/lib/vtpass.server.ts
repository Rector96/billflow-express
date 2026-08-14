/**
 * VTpass server client — SANDBOX only.
 * Secrets never use VITE_* or any client-exposed env.
 */

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

const FAIL_CODES = new Set([
  "011",
  "012",
  "013",
  "014",
  "016",
  "017",
  "018",
  "019",
  "021",
  "022",
  "023",
  "024",
  "027",
  "028",
  "030",
  "034",
  "035",
  "087",
  "091",
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
const CATALOGUE_TTL_MS = 5 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  const hit = catalogueCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CATALOGUE_TTL_MS) {
    catalogueCache.delete(key);
    return null;
  }
  return hit.data as T;
}

function cacheSet(key: string, data: unknown) {
  catalogueCache.set(key, { at: Date.now(), data });
}

/** Map RockPay network labels → VTpass airtime serviceID */
export function toVtpassServiceId(provider: string): string {
  const p = provider.trim().toLowerCase();
  if (p.includes("mtn")) return "mtn";
  if (p.includes("glo")) return "glo";
  if (p.includes("airtel")) return "airtel";
  if (p.includes("9mobile") || p.includes("etisalat") || p.includes("9 mobile")) return "etisalat";
  throw new Error("unsupported_network");
}

/** Map RockPay network labels / catalogue names → VTpass data serviceID */
export function toVtpassDataServiceId(provider: string): string {
  const p = provider.trim().toLowerCase();
  if (p === "mtn-data" || p.includes("mtn")) return "mtn-data";
  if (p === "glo-data" || p.includes("glo")) return "glo-data";
  if (p === "airtel-data" || p.includes("airtel")) return "airtel-data";
  if (
    p === "etisalat-data" ||
    p.includes("9mobile") ||
    p.includes("etisalat") ||
    p.includes("9 mobile")
  ) {
    return "etisalat-data";
  }
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
  if (mode === "live") {
    throw new Error("VTpass live mode is disabled. Set VTPASS_MODE=sandbox.");
  }

  const baseUrl = (process.env["VTPASS_BASE_URL"] ?? "https://sandbox.vtpass.com/api")
    .trim()
    .replace(/\/$/, "");

  const apiKey = (process.env["VTPASS_API_KEY"] ?? "").trim();
  const secretKey = (process.env["VTPASS_SECRET_KEY"] ?? "").trim();
  const publicKey = (process.env["VTPASS_PUBLIC_KEY"] ?? "").trim();

  if (!apiKey || !secretKey) {
    throw new Error(
      "VTpass is not configured. Set VTPASS_API_KEY and VTPASS_SECRET_KEY (sandbox) on the host.",
    );
  }

  return { mode: "sandbox", baseUrl, apiKey, secretKey, publicKey };
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
  // Prefer public-key for GET when available (VTpass docs); fall back to secret.
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

async function vtpassGetJson(path: string): Promise<unknown> {
  const { baseUrl } = getVtpassConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: headersForGet(),
    signal: AbortSignal.timeout(20_000),
  });
  return res.json().catch(() => ({}));
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
    .map((row: Record<string, unknown>) => ({
      serviceID: String(row["serviceID"] ?? ""),
      name: String(row["name"] ?? row["serviceID"] ?? ""),
      minimumAmount: row["minimium_amount"] != null ? Number(row["minimium_amount"]) : null,
      maximumAmount: row["maximum_amount"] != null ? Number(row["maximum_amount"]) : null,
      productType: row["product_type"] != null ? String(row["product_type"]) : null,
      image: row["image"] != null ? String(row["image"]) : null,
    }))
    .filter((s) => s.serviceID);

  // For mobile data, prefer the four major networks only (hide Smile etc. in V1).
  if (identifier === "data") {
    const mobile = mapped.filter((s) => MOBILE_DATA_SERVICE_IDS.has(s.serviceID));
    if (mobile.length > 0) mapped = mobile;
  }

  if (mapped.length === 0) {
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
  )) as { content?: Record<string, unknown> };
  const content = raw.content ?? {};
  const list = (content["variations"] ?? content["varations"] ?? []) as unknown[];
  const mapped: VtpassVariation[] = (Array.isArray(list) ? list : [])
    .map((row: Record<string, unknown>) => ({
      variationCode: String(row["variation_code"] ?? ""),
      name: String(row["name"] ?? ""),
      amount: Number(row["variation_amount"] ?? 0),
      fixedPrice: String(row["fixedPrice"] ?? "Yes").toLowerCase() === "yes",
    }))
    .filter((v) => v.variationCode);

  if (mapped.length === 0) {
    throw new Error("Service information is temporarily unavailable. Please try again.");
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
  } catch {
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
      message: "Could not verify details right now. Please try again.",
    };
  }

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(raw["code"] ?? "");
  const content = (raw["content"] ?? {}) as Record<string, unknown>;
  const ok = code === "000" || code === "020";

  const minRaw =
    content["Min_Purchase_Amount"] ?? content["min_purchase_amount"] ?? content["Minimum_Amount"];

  return {
    ok,
    code,
    customerName:
      content["Customer_Name"] != null
        ? String(content["Customer_Name"])
        : content["customer_name"] != null
          ? String(content["customer_name"])
          : null,
    address: content["Address"] != null ? String(content["Address"]) : null,
    status: content["Status"] != null ? String(content["Status"]) : null,
    dueDate: content["Due_Date"] != null ? String(content["Due_Date"]) : null,
    customerNumber:
      content["Customer_Number"] != null ? String(content["Customer_Number"]) : null,
    minPurchaseAmount: minRaw != null && Number.isFinite(Number(minRaw)) ? Number(minRaw) : null,
    tariff: content["Tariff"] != null ? String(content["Tariff"]) : null,
    meterNumber: content["Meter_Number"] != null ? String(content["Meter_Number"]) : null,
    raw: content,
    message: ok
      ? "Verified"
      : String(raw["response_description"] ?? "Could not verify this number. Check and try again."),
  };
}

function parsePayResponse(raw: Record<string, unknown>, fallbackRequestId: string): VtpassPayResult {
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

  return {
    code,
    responseDescription: String(raw["response_description"] ?? ""),
    requestId: String(raw["requestId"] ?? fallbackRequestId),
    transactionId: tx["transactionId"] != null ? String(tx["transactionId"]) : null,
    contentStatus: tx["status"] != null ? String(tx["status"]).toLowerCase() : null,
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

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/pay`, {
      method: "POST",
      headers: headersForPost(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    console.error("[vtpass] pay network/timeout", input.requestId);
    return {
      code: "TIMEOUT",
      responseDescription: "timeout",
      requestId: input.requestId,
      transactionId: null,
      contentStatus: null,
      purchasedCode: null,
      raw: { error: String(err) },
    };
  }

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return parsePayResponse(raw, input.requestId);
}

/** Generic pay for cable / electricity / data (and future catalogue products). */
export async function vtpassPay(body: Record<string, unknown>): Promise<VtpassPayResult> {
  const { baseUrl } = getVtpassConfig();
  const requestId = String(body["request_id"] ?? "");

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/pay`, {
      method: "POST",
      headers: headersForPost(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    console.error("[vtpass] pay network/timeout", requestId);
    return {
      code: "TIMEOUT",
      responseDescription: "timeout",
      requestId,
      transactionId: null,
      contentStatus: null,
      purchasedCode: null,
      raw: { error: String(err) },
    };
  }

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return parsePayResponse(raw, requestId);
}

export async function vtpassRequery(requestId: string): Promise<VtpassPayResult> {
  const { baseUrl } = getVtpassConfig();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/requery`, {
      method: "POST",
      headers: headersForPost(),
      body: JSON.stringify({ request_id: requestId }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error("[vtpass] requery network/timeout", requestId);
    return {
      code: "TIMEOUT",
      responseDescription: "timeout",
      requestId,
      transactionId: null,
      contentStatus: null,
      purchasedCode: null,
      raw: { error: String(err) },
    };
  }

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return parsePayResponse(raw, requestId);
}

/** Map VTpass response → RockPay outcome (never trust the browser). */
export function mapVtpassOutcome(
  result: VtpassPayResult,
): "successful" | "failed" | "pending" {
  if (result.code === "TIMEOUT" || result.code === "") return "pending";
  if (result.code === "099") return "pending";
  if (FAIL_CODES.has(result.code)) return "failed";
  if (result.code === "000") {
    const s = result.contentStatus;
    if (s === "delivered") return "successful";
    if (s === "failed") return "failed";
    return "pending";
  }
  return "pending";
}
