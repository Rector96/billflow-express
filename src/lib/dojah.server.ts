/**
 * Dojah server-only client. Secrets never leave the server.
 * Docs: Authorization = secret key (NOT Bearer), AppId header required.
 */

export type DojahConfig = {
  baseUrl: string;
  secretKey: string;
  appId: string;
  mode: "sandbox" | "live";
};

export function getDojahConfig(): DojahConfig {
  const secretKey = String(process.env["DOJAH_SECRET_KEY"] ?? "").trim();
  const appId = String(process.env["DOJAH_APP_ID"] ?? "").trim();
  const modeRaw = String(process.env["DOJAH_MODE"] ?? "sandbox")
    .trim()
    .toLowerCase();
  const mode = modeRaw === "live" || modeRaw === "production" ? "live" : "sandbox";
  const baseUrl =
    String(process.env["DOJAH_BASE_URL"] ?? "").trim() ||
    (mode === "live" ? "https://api.dojah.io" : "https://sandbox.dojah.io");

  if (!secretKey || !appId) {
    throw new Error(
      "Dojah is not configured. Set DOJAH_SECRET_KEY and DOJAH_APP_ID on the server (Netlify env).",
    );
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), secretKey, appId, mode };
}

export function isDojahConfigured(): boolean {
  try {
    getDojahConfig();
    return true;
  } catch {
    return false;
  }
}

async function dojahGet(pathWithQuery: string): Promise<unknown> {
  const cfg = getDojahConfig();
  const url = `${cfg.baseUrl}${pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: cfg.secretKey,
      AppId: cfg.appId,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body && "error" in body
        ? String((body as { error?: unknown }).error)
        : typeof body === "object" && body && "message" in body
          ? String((body as { message?: unknown }).message)
          : `Dojah error ${res.status}`;
    const err = new Error(msg);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return body;
}

export type TinLookupResult = {
  tin: string;
  taxpayerName: string;
  taxpayerType: "individual" | "business";
  cacNumber: string | null;
  nin: string | null;
  rawProvider: "dojah";
};

/** Company TIN via CAC RC number (Dojah GET /api/v1/kyc/cac/tin). */
export async function dojahLookupCompanyTin(input: {
  rcNumber: string;
  companyType?: string;
}): Promise<TinLookupResult> {
  const rc = input.rcNumber.replace(/\s/g, "").trim();
  const companyType = (input.companyType || "COMPANY").toUpperCase();
  const q = new URLSearchParams({
    rc_number: rc,
    company_type: companyType,
  });
  const body = (await dojahGet(`/api/v1/kyc/cac/tin?${q.toString()}`)) as {
    entity?: {
      tax_id?: string;
      company_name?: string;
      rc_number?: string;
      company_type?: string;
    };
  };
  const entity = body.entity ?? {};
  const tin = String(entity.tax_id ?? "").trim();
  if (!tin) throw new Error("No TIN found for this CAC number.");
  return {
    tin,
    taxpayerName: String(entity.company_name ?? "Registered business").trim(),
    taxpayerType: "business",
    cacNumber: String(entity.rc_number ?? rc),
    nin: null,
    rawProvider: "dojah",
  };
}

/**
 * Vehicle registry lookup.
 * Uses Dojah vehicle/plate product when available; surfaces clear errors otherwise.
 */
export type VehicleLookupResult = {
  plate: string;
  state: string;
  makeModel: string;
  chassisMasked: string;
  chassisFull: string;
  color: string;
  expiryStatus: "valid" | "expiring_soon" | "expired" | "unknown";
  expiryLabel: string;
  rawProvider: "dojah";
};

export async function dojahLookupVehicle(input: {
  plate: string;
  state: string;
}): Promise<VehicleLookupResult> {
  const plate = input.plate.replace(/\s+/g, "").toUpperCase();
  const q = new URLSearchParams({
    vehicle_number: plate,
    plate_number: plate,
  });
  // Preferred product path — Dojah may expose FRSC/vehicle under KYC.
  try {
    const body = (await dojahGet(`/api/v1/kyc/vehicle?${q.toString()}`)) as {
      entity?: Record<string, unknown>;
    };
    const e = body.entity ?? {};
    const chassis = String(e["chassis_number"] ?? e["chassis"] ?? e["vin"] ?? "");
    const make = String(e["make"] ?? e["vehicle_make"] ?? "");
    const model = String(e["model"] ?? e["vehicle_model"] ?? "");
    const color = String(e["color"] ?? e["vehicle_color"] ?? "—");
    const expiry = String(e["expiry_date"] ?? e["license_expiry"] ?? "");
    const { status, label } = classifyExpiry(expiry);
    return {
      plate,
      state: input.state,
      makeModel: [make, model].filter(Boolean).join(" ") || "Vehicle record",
      chassisMasked: chassis ? `••••••••${chassis.slice(-4)}` : "••••••••",
      chassisFull: chassis || "UNAVAILABLE",
      color,
      expiryStatus: status,
      expiryLabel: label,
      rawProvider: "dojah",
    };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      throw new Error(
        "Vehicle registry product is not enabled on this Dojah app yet. Enable it in Dojah dashboard or contact support.",
      );
    }
    throw err;
  }
}

function classifyExpiry(isoOrLabel: string): {
  status: VehicleLookupResult["expiryStatus"];
  label: string;
} {
  if (!isoOrLabel.trim()) return { status: "unknown", label: "Expiry not provided" };
  const t = Date.parse(isoOrLabel);
  if (!Number.isFinite(t)) return { status: "unknown", label: isoOrLabel };
  const days = (t - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return { status: "expired", label: `Expired — ${isoOrLabel}` };
  if (days < 45) return { status: "expiring_soon", label: `Expiring soon — ${isoOrLabel}` };
  return { status: "valid", label: `Valid until ${isoOrLabel}` };
}
