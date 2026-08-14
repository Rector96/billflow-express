/**
 * VTpass server client — SANDBOX only for Phase 4A.
 * Secrets never use VITE_* or any client-exposed env.
 *
 * Docs:
 * - Auth: https://www.vtpass.com/documentation/authentication/
 * - Pay:  https://sandbox.vtpass.com/api/pay
 * - Requery: https://sandbox.vtpass.com/api/requery
 * - Codes: https://www.vtpass.com/documentation/response-codes/
 */

export type VtpassMode = "sandbox" | "live";

export type VtpassPayResult = {
  code: string;
  responseDescription: string;
  requestId: string;
  transactionId: string | null;
  contentStatus: string | null;
  raw: unknown;
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

/** Map RockPay network labels → VTpass serviceID */
export function toVtpassServiceId(provider: string): string {
  const p = provider.trim().toLowerCase();
  if (p.includes("mtn")) return "mtn";
  if (p.includes("glo")) return "glo";
  if (p.includes("airtel")) return "airtel";
  if (p.includes("9mobile") || p.includes("etisalat") || p.includes("9 mobile")) return "etisalat";
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

  const baseUrl = (
    process.env["VTPASS_BASE_URL"] ?? "https://sandbox.vtpass.com/api"
  )
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

export function normalizeNgPhone(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("234") && d.length === 13) d = `0${d.slice(3)}`;
  if (d.length === 10 && /^[789]/.test(d)) d = `0${d}`;
  if (!/^0[789][01]\d{8}$/.test(d)) {
    throw new Error("Enter a valid Nigerian mobile number.");
  }
  return d;
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
      raw: { error: String(err) },
    };
  }

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(raw["code"] ?? "");
  const content = (raw["content"] ?? {}) as Record<string, unknown>;
  const tx = (content["transactions"] ?? {}) as Record<string, unknown>;

  return {
    code,
    responseDescription: String(raw["response_description"] ?? ""),
    requestId: String(raw["requestId"] ?? input.requestId),
    transactionId: tx["transactionId"] != null ? String(tx["transactionId"]) : null,
    contentStatus: tx["status"] != null ? String(tx["status"]).toLowerCase() : null,
    raw,
  };
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
      raw: { error: String(err) },
    };
  }

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(raw["code"] ?? "");
  const content = (raw["content"] ?? {}) as Record<string, unknown>;
  const tx = (content["transactions"] ?? {}) as Record<string, unknown>;

  return {
    code,
    responseDescription: String(raw["response_description"] ?? ""),
    requestId: String(raw["requestId"] ?? requestId),
    transactionId: tx["transactionId"] != null ? String(tx["transactionId"]) : null,
    contentStatus: tx["status"] != null ? String(tx["status"]).toLowerCase() : null,
    raw,
  };
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
    return "pending"; // initiated | pending | unknown
  }
  // Any other code → treat as pending and requery (per VTpass docs)
  return "pending";
}
