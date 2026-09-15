/**
 * Product/service availability is intentionally centralized here.
 *
 * IMPORTANT:
 * - A route existing in the app does NOT mean the service is production-ready.
 * - `isBillLive()` is used by the Services UI to decide whether a customer may
 *   enter a payment flow. Keep a service out of LIVE_BILL_SLUGS until its
 *   provider/fulfillment path is real and payment-safe.
 * - Demo/fallback data must never be presented as a completed government or
 *   regulated service. Services without a real provider are shown as coming soon.
 *
 * Current production-ready core services:
 * electricity, cable, education/exam-pins, airtime and data.
 *
 * Hub services that depend on external verification/fulfillment (CAC, NIN, TIN,
 * vehicle) are deliberately NOT marked live until the required provider access
 * is configured. Documents is also held back until its server-side payment and
 * real PDF delivery path is complete.
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
 *
 * Do not add a service merely because its UI exists. In particular, CAC/NIN/TIN/
 * vehicle must stay out until their real provider integrations are available.
 */
export const LIVE_BILL_SLUGS = new Set([
  "electricity",
  "cable",
  "education",
  "exam-pins",
  "airtime",
  "data",
]);

export function homeServiceSlugs(): readonly string[] {
  return BILLS_FOCUS ? HOME_BILL_SLUGS : HOME_CLASSIC_SLUGS;
}

export function isServiceVisible(slug: string): boolean {
  if (!BILLS_FOCUS) return true;
  return !HIDDEN_WHEN_BILLS_FOCUS.has(slug);
}

/**
 * Production gate for payment-capable services.
 * Returning false intentionally makes an unfinished hub module display as
 * unavailable/coming soon instead of accepting money that cannot be fulfilled.
 */
export function isBillLive(slug: string): boolean {
  return LIVE_BILL_SLUGS.has(slug);
}
