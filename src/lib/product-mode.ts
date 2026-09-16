/**
 * Product/service availability is intentionally centralized here.
 *
 * Layers:
 * 1) `isBillLive()` — real production fulfillment (wallet/VTpass money path).
 * 2) `HUB_PREVIEW_FLOWS` — interactive UI for hub services so you can QA every step.
 * 3) `isServiceFlowOpen()` — UI may open the wizard (live OR hub preview).
 *
 * Default: hub preview is ON so CAC/NIN/etc work on Netlify while the product is unfinished.
 * When you are ready for strict production: set Netlify `VITE_HUB_PREVIEW_FLOWS=false`.
 * Only promote into LIVE_BILL_SLUGS when fulfillment is real.
 */
export const BILLS_FOCUS = false;
export const DIRECT_PAY = true;

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

/** Only services with verified production fulfillment. */
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
 * Default ON — hub flows stay usable while we finish the product.
 * Set VITE_HUB_PREVIEW_FLOWS=false on Netlify only when you want “coming soon” for hub.
 */
export const HUB_PREVIEW_FLOWS = readEnvFlag("VITE_HUB_PREVIEW_FLOWS", true);

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
  return HUB_PREVIEW_FLOWS && HUB_PREVIEW_SLUGS.has(slug) && !isBillLive(slug);
}

export function isServiceFlowOpen(slug: string): boolean {
  if (isBillLive(slug)) return true;
  if (HUB_PREVIEW_FLOWS && HUB_PREVIEW_SLUGS.has(slug)) return true;
  return false;
}

export function serviceAvailabilityLabel(slug: string, short: string): string {
  if (isBillLive(slug)) return short;
  if (isHubDemoOnly(slug)) return `${short} · Demo`;
  return `${short} · Soon`;
}
