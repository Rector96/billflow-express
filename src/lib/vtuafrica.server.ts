/**
 * VTUAfrica aggregator (fallback when VTpass is down or product unavailable).
 * Docs: https://vtuafrica.com.ng/api/
 * Env: VTUAFRICA_API_KEY, optional VTUAFRICA_MODE=sandbox|live
 */

export type VtuafricaPayResult = {
  ok: boolean;
  code: string;
  message: string;
  reference: string;
  token: string | null;
  transactionId: string | null;
  raw: unknown;
};

function getConfig() {
  const key = (process.env["VTUAFRICA_API_KEY"] ?? "").trim();
  if (!key) {
    throw new Error(
      "VTUAfrica is not configured. Set VTUAFRICA_API_KEY in environment variables.",
    );
  }
  const mode = (process.env["VTUAFRICA_MODE"] ?? "sandbox").trim().toLowerCase();
  const base =
    mode === "live"
      ? "https://vtuafrica.com.ng/portal/api"
      : "https://vtuafrica.com.ng/portal/api-test";
  return { key, base, mode };
}

export function isVtuafricaConfigured(): boolean {
  return Boolean((process.env["VTUAFRICA_API_KEY"] ?? "").trim());
}

/** Map common VTpass electricity serviceIDs → VTUAfrica service codes */
export function mapElectricServiceToVtuafrica(serviceID: string): string {
  const s = serviceID.toLowerCase().replace(/_/g, "-");
  const map: Record<string, string> = {
    "ikeja-electric": "ikeja-electric",
    "eko-electric": "eko-electric",
    "abuja-electric": "abuja-electric",
    "kano-electric": "kano-electric",
    "portharcourt-electric": "portharcourt-electric",
    "jos-electric": "jos-electric",
    "ibadan-electric": "ibadan-electric",
    "kaduna-electric": "kaduna-electric",
    "enugu-electric": "enugu-electric",
    "benin-electric": "benin-electric",
    "yola-electric": "yola-electric",
    "aba-electric": "aba-electric",
  };
  return map[s] ?? s;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { code: String(res.status), description: text.slice(0, 200) };
  }
}

function parseResult(raw: Record<string, unknown>, ref: string): VtuafricaPayResult {
  const code = String(raw["code"] ?? raw["Code"] ?? "");
  const desc = raw["description"];
  let message = "";
  let token: string | null = null;
  let status = "";
  if (desc && typeof desc === "object") {
    const d = desc as Record<string, unknown>;
    status = String(d["Status"] ?? d["status"] ?? "");
    message = String(d["message"] ?? d["Message"] ?? status);
    token =
      (typeof d["Token"] === "string" && d["Token"]) ||
      (typeof d["token"] === "string" && d["token"]) ||
      null;
  } else if (typeof desc === "string") {
    message = desc;
  }
  const ok =
    code === "101" ||
    status.toLowerCase() === "completed" ||
    status.toLowerCase() === "successful" ||
    /success/i.test(message);
  return {
    ok,
    code,
    message: message || (ok ? "Successful" : "Provider declined"),
    reference: ref,
    token,
    transactionId: typeof raw["transaction_id"] === "string" ? raw["transaction_id"] : ref,
    raw,
  };
}

export async function vtuafricaPayElectricity(input: {
  serviceID: string;
  meterNo: string;
  meterType: string;
  amount: number;
  ref: string;
}): Promise<VtuafricaPayResult> {
  const { key, base } = getConfig();
  const service = mapElectricServiceToVtuafrica(input.serviceID);
  const params = new URLSearchParams({
    apikey: key,
    service,
    meterNo: input.meterNo,
    metertype: input.meterType.toLowerCase(),
    amount: String(Math.round(input.amount)),
    ref: input.ref,
  });
  const url = `${base}/electric/?${params.toString()}`;
  const raw = await getJson(url);
  return parseResult(raw, input.ref);
}

export async function vtuafricaPayCable(input: {
  serviceID: string;
  smartcard: string;
  amount: number;
  ref: string;
  variation?: string;
}): Promise<VtuafricaPayResult> {
  const { key, base } = getConfig();
  // VTUAfrica cable products often use service codes like dstv, gotv, startimes
  const service = input.serviceID.toLowerCase().replace(/_/g, "-").replace(/-subscription$/, "");
  const params = new URLSearchParams({
    apikey: key,
    service,
    smartcardNo: input.smartcard,
    amount: String(Math.round(input.amount)),
    ref: input.ref,
  });
  if (input.variation) params.set("variation_code", input.variation);
  // Primary path used by many VTUAfrica portals
  const url = `${base}/tv/?${params.toString()}`;
  const raw = await getJson(url);
  return parseResult(raw, input.ref);
}
