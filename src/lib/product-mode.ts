/**
 * Product mode — ONE place to reverse.
 *
 * BILLS_FOCUS = true  → utility bills first, airtime/data hidden, soft wallet CTAs
 * DIRECT_PAY  = true  → electricity/cable: Paystack checkout (no wallet PIN debit)
 *
 * Set both false to restore classic wallet fintech.
 */
export const BILLS_FOCUS = true;
export const DIRECT_PAY = true;

export const HOME_BILL_SLUGS = ["electricity", "cable", "education"] as const;

export const HOME_CLASSIC_SLUGS = [
  "electricity",
  "cable",
  "education",
  "airtime",
  "data",
] as const;

export const HIDDEN_WHEN_BILLS_FOCUS = new Set(["airtime", "data"]);

export function homeServiceSlugs(): readonly string[] {
  return BILLS_FOCUS ? HOME_BILL_SLUGS : HOME_CLASSIC_SLUGS;
}

export function isServiceVisible(slug: string): boolean {
  if (!BILLS_FOCUS) return true;
  return !HIDDEN_WHEN_BILLS_FOCUS.has(slug);
}
