/**
 * Product mode — ONE place to reverse.
 *
 * BILLS_FOCUS = true  → utility + education bills; airtime/data and non-bills hidden
 * DIRECT_PAY  = true  → electricity/cable: Paystack checkout (no wallet PIN debit)
 *
 * Education & exam pins share the same student-friendly PIN purchase flow (VTpass).
 */
export const BILLS_FOCUS = true;
export const DIRECT_PAY = true;

/** Home grid when bills-focused */
export const HOME_BILL_SLUGS = ["electricity", "cable", "education", "exam-pins"] as const;

/** Classic home (full fintech) */
export const HOME_CLASSIC_SLUGS = ["electricity", "cable", "education", "airtime", "data"] as const;

/** Hidden on Services + Home when BILLS_FOCUS */
export const HIDDEN_WHEN_BILLS_FOCUS = new Set([
  "airtime",
  "data",
  "internet",
  "water",
  "insurance",
]);

/** Live bill services (not "coming soon") */
export const LIVE_BILL_SLUGS = new Set(["electricity", "cable", "education", "exam-pins"]);

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
