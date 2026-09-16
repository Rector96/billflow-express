/**
 * Product/service availability is intentionally centralized here.
 *
 * Layers:
 * 1) `isBillLive()` — real production fulfillment (wallet/VTpass money path).
 * 2) `HUB_PREVIEW_FLOWS` — interactive UI demos for hub services so product/QA
 *    can walk every step before APIs exist. Does NOT add a service to LIVE_BILL_SLUGS.
 * 3) `isServiceFlowOpen()` — UI may open the wizard (live OR hub preview).
 *
 * Production launch: set Netlify `VITE_HUB_PREVIEW_FLOWS=false` so unfinished
 * hub services show “coming soon” again. Only promote into LIVE_BILL_SLUGS when
 * fulfillment is real.
 *
 * Demo results must never be treated as official CAC/NIN/TIN government output.
 */
export const BILLS_FOCUS = false;
export const DIRECT_PAY = true;

/** Home grid when bills-focused */
export const HOME_BILL_SLUGS = ["electricity", "cable", "education", "exam-pins"] as const;

/** Classic home (full fintech + hub modules) */
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

/** Hidden on Services + Home when BILLS_FOCUS */
export const HIDDEN_WHEN_BILLS_FOCUS = new Set([
  "airtime",
  "data",
  "internet",
  "water",
  "insurance",
]);

/**
 * Only services with a verified production fulfillment path belong here.
 * Exam PINs stay out until VTpass + DB availability are confirmed end-to-end.
 */
export const LIVE_BILL_SLUGS = new Set(["electricity", "cable", "airtime", "data"]);

/** Hub + education wizards allowed in preview (not the same as LIVE). */
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
 * Default TRUE while the app is unfinished so every hub flow is clickable.
 * Set `VITE_HUB_PREVIEW_FLOWS=false` on production Netlify when you want
 * non-live hub services to show “coming soon” only.
 */
export const HUB_PREVIEW_FLOWS = readEnvFlag("VITE_HUB_PREVIEW_FLOWS", true);

export function homeServiceSlugs(): readonly string[] {
  return BILLS_FOCUS ? HOME_BILL_SLUGS : HOME_CLASSIC_SLUGS;
}

export function isServiceVisible(slug: string): boolean {
  if (!BILLS_FOCUS) return true;
  return !HIDDEN_WHEN_BILLS_FOCUS.has(slug);
}

/**
 * Production gate for real bill fulfillment / customer money that must settle.
 */
export function isBillLive(slug: string): boolean {
  return LIVE_BILL_SLUGS.has(slug);
}

/** True when this slug is only open because of hub preview (not production live). */
export function isHubDemoOnly(slug: string): boolean {
  return HUB_PREVIEW_FLOWS && HUB_PREVIEW_SLUGS.has(slug) && !isBillLive(slug);
}

/**
 * Whether the customer UI may open the multi-step flow.
 * Live bills always open; hub services open in preview so you can QA UX.
 */
export function isServiceFlowOpen(slug: string): boolean {
  if (isBillLive(slug)) return true;
  if (HUB_PREVIEW_FLOWS && HUB_PREVIEW_SLUGS.has(slug)) return true;
  return false;
}

/** Label suffix for service tiles */
export function serviceAvailabilityLabel(slug: string, short: string): string {
  if (isBillLive(slug)) return short;
  if (isHubDemoOnly(slug)) return `${short} · Demo`;
  return `${short} · Soon`;
}
