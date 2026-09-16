/**
 * Product/service availability — ONE control surface.
 *
 * Airtime & Data are fully removed from the customer product.
 * Remaining live bills: electricity, cable.
 * Hub: CAC, NIN, TIN, Documents, Vehicle, Education (demo UI).
 */
export const BILLS_FOCUS = false;
export const DIRECT_PAY = true;

const FORCE_HUB_UI = true;

/** Permanently hidden from Home, Services, search, and pay entry. */
export const REMOVED_SERVICE_SLUGS = new Set(["airtime", "data"]);

export const HOME_BILL_SLUGS = ["electricity", "cable", "education", "exam-pins"] as const;

export const HOME_CLASSIC_SLUGS = [
  "electricity",
  "cable",
  "education",
  "cac",
  "nin",
  "tin",
  "documents",
  "vehicle",
] as const;

export const HIDDEN_WHEN_BILLS_FOCUS = new Set([
  "internet",
  "water",
  "insurance",
]);

/** Live bill fulfillment only (no airtime/data). */
export const LIVE_BILL_SLUGS = new Set(["electricity", "cable"]);

export const HUB_PREVIEW_SLUGS = new Set([
  "cac",
  "nin",
  "tin",
  "documents",
  "vehicle",
  "education",
  "exam-pins",
]);

function readEnvFlag(key: string, defaultValue: boolean): boolean {
  try {
    const env = import.meta.env as Record<string, string | boolean | undefined>;
    const raw = env[key];
    if (raw === undefined || raw === "") return defaultValue;
    if (typeof raw === "boolean") return raw;
    const s = String(raw).trim().toLowerCase();
    if (["0", "false", "no", "off"].includes(s)) return false;
    if (["1", "true", "yes", "on"].includes(s)) return true;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

export const HUB_PREVIEW_FLOWS = FORCE_HUB_UI || readEnvFlag("VITE_HUB_PREVIEW_FLOWS", true);

export function homeServiceSlugs(): readonly string[] {
  return BILLS_FOCUS ? HOME_BILL_SLUGS : HOME_CLASSIC_SLUGS;
}

export function isServiceVisible(slug: string): boolean {
  if (REMOVED_SERVICE_SLUGS.has(slug)) return false;
  if (!BILLS_FOCUS) return true;
  return !HIDDEN_WHEN_BILLS_FOCUS.has(slug);
}

export function isBillLive(slug: string): boolean {
  if (REMOVED_SERVICE_SLUGS.has(slug)) return false;
  return LIVE_BILL_SLUGS.has(slug);
}

export function isHubDemoOnly(slug: string): boolean {
  return HUB_PREVIEW_SLUGS.has(slug) && !isBillLive(slug);
}

export function isServiceFlowOpen(slug: string): boolean {
  if (REMOVED_SERVICE_SLUGS.has(slug)) return false;
  if (isBillLive(slug)) return true;
  if (FORCE_HUB_UI && HUB_PREVIEW_SLUGS.has(slug)) return true;
  if (HUB_PREVIEW_FLOWS && HUB_PREVIEW_SLUGS.has(slug)) return true;
  return false;
}

export function serviceAvailabilityLabel(slug: string, short: string): string {
  if (REMOVED_SERVICE_SLUGS.has(slug)) return `${short} · Removed`;
  if (isBillLive(slug)) return short;
  if (isHubDemoOnly(slug)) return `${short} · Demo`;
  return `${short} · Soon`;
}
