/**
 * Product/service availability — ONE control surface.
 *
 * Hub services (CAC, NIN, TIN, Documents, Vehicle, Education):
 *   Always open the UI wizards on this branch so Netlify works without env tricks.
 *   Demo banners remain via isHubDemoOnly (not live money path).
 *
 * Real bill money path: only LIVE_BILL_SLUGS (airtime/data/electricity/cable).
 *
 * To close hub UI later for true production lock-down, set FORCE_HUB_UI = false
 * and deploy with VITE_HUB_PREVIEW_FLOWS=false.
 */
export const BILLS_FOCUS = false;
export const DIRECT_PAY = true;

/** When true, CAC/NIN/etc always open (ignore Netlify env). */
const FORCE_HUB_UI = true;

export const HOME_BILL_SLUGS = ["electricity", "cable", "education", "exam-pins"] as const;

export const HOME_CLASSIC_SLUGS = [
  "electricity",
  "cable",
  "education",
  "airtime",
  "data",
  "cac",
  "nin",
  "tin",
  "documents",
  "vehicle",
] as const;

export const HIDDEN_WHEN_BILLS_FOCUS = new Set([
  "airtime",
  "data",
  "internet",
  "water",
  "insurance",
]);

/** Verified production bill fulfillment only. */
export const LIVE_BILL_SLUGS = new Set(["electricity", "cable", "airtime", "data"]);

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

/**
 * Hub preview flag.
 * FORCE_HUB_UI wins so Netlify cannot leave CAC stuck on “coming soon”.
 */
export const HUB_PREVIEW_FLOWS = FORCE_HUB_UI || readEnvFlag("VITE_HUB_PREVIEW_FLOWS", true);

export function homeServiceSlugs(): readonly string[] {
  return BILLS_FOCUS ? HOME_BILL_SLUGS : HOME_CLASSIC_SLUGS;
}

export function isServiceVisible(slug: string): boolean {
  if (!BILLS_FOCUS) return true;
  return !HIDDEN_WHEN_BILLS_FOCUS.has(slug);
}

export function isBillLive(slug: string): boolean {
  return LIVE_BILL_SLUGS.has(slug);
}

export function isHubDemoOnly(slug: string): boolean {
  return HUB_PREVIEW_SLUGS.has(slug) && !isBillLive(slug);
}

/** UI may open the wizard. */
export function isServiceFlowOpen(slug: string): boolean {
  if (isBillLive(slug)) return true;
  if (FORCE_HUB_UI && HUB_PREVIEW_SLUGS.has(slug)) return true;
  if (HUB_PREVIEW_FLOWS && HUB_PREVIEW_SLUGS.has(slug)) return true;
  return false;
}

export function serviceAvailabilityLabel(slug: string, short: string): string {
  if (isBillLive(slug)) return short;
  if (isHubDemoOnly(slug)) return `${short} · Demo`;
  return `${short} · Soon`;
}
