/**
 * Product mode — ONE switch to reverse.
 *
 * BILLS_FOCUS = true  → utility bills first, airtime/data hidden, soft wallet
 * BILLS_FOCUS = false → classic fintech (airtime, data, fund wallet) — REVERSE
 *
 * Backend wallet + VTpass purchase paths are unchanged so flip is safe.
 * Full Paystack-per-bill (no float) can be layered later without redesign.
 */
export const BILLS_FOCUS = true;

/** Services shown on Home “Pay Bills” grid when BILLS_FOCUS */
export const HOME_BILL_SLUGS = ["electricity", "cable", "education"] as const;

/** Classic home grid (reverse mode) */
export const HOME_CLASSIC_SLUGS = [
  "electricity",
  "cable",
  "education",
  "airtime",
  "data",
] as const;

/** Hide these from Services list when BILLS_FOCUS */
export const HIDDEN_WHEN_BILLS_FOCUS = new Set(["airtime", "data"]);

export function homeServiceSlugs(): readonly string[] {
  return BILLS_FOCUS ? HOME_BILL_SLUGS : HOME_CLASSIC_SLUGS;
}

export function isServiceVisible(slug: string): boolean {
  if (!BILLS_FOCUS) return true;
  return !HIDDEN_WHEN_BILLS_FOCUS.has(slug);
}
