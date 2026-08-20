/**
 * RockPay pricing engine (server-only).
 *
 * Pure calculation + rule matching. Does not trust client-supplied final prices.
 * Callers pass: service, provider, productCode, baseAmount.
 * Engine returns the customer-facing amount from trusted pricing rules.
 *
 * Fallback (no matching active rule) = baseAmount unchanged (zero markup).
 */

export type PricingService = "airtime" | "data" | "cable" | "electricity";

export type MarkupType = "fixed" | "percentage" | "selling_price";

/** Row shape matching public.pricing_rules (local until types regenerate). */
export type PricingRuleRow = {
  id: string;
  service: PricingService;
  provider: string | null;
  product_code: string | null;
  markup_type: MarkupType;
  markup_value: number;
  min_amount: number | null;
  max_amount: number | null;
  is_active: boolean;
  priority: number;
};

export type ApplyPricingInput = {
  service: PricingService;
  /** e.g. mtn, dstv, ikeja-electric — normalized to lowercase */
  provider?: string | null;
  /** variation_code / plan code */
  productCode?: string | null;
  /** Provider/base amount in NGN (what VTpass would charge for the product) */
  baseAmount: number;
};

export type ApplyPricingResult = {
  baseAmount: number;
  /** Final amount to debit the customer */
  customerAmount: number;
  /** RockPay markup/fee (customerAmount - baseAmount for fixed/%; for selling_price may differ) */
  rockpayFee: number;
  pricingRuleId: string | null;
  markupType: MarkupType | null;
  markupValue: number | null;
  usedFallback: boolean;
};

const SERVICES = new Set<PricingService>(["airtime", "data", "cable", "electricity"]);
const MARKUP_TYPES = new Set<MarkupType>(["fixed", "percentage", "selling_price"]);

/** Round to 2 decimal places (kobo-safe for NGN). */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

function norm(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim().toLowerCase();
  return t.length ? t : null;
}

function assertValidBase(baseAmount: number): number {
  const base = roundMoney(Number(baseAmount));
  if (!Number.isFinite(base) || base < 0) {
    throw new Error("Invalid base amount.");
  }
  return base;
}

/**
 * Apply a single rule to a base amount. Does not select the rule.
 * Returns customer amount before min/max clamp is applied by caller if needed;
 * this function applies min/max from the rule.
 */
export function computeFromRule(rule: PricingRuleRow, baseAmount: number): number {
  const base = assertValidBase(baseAmount);
  const value = Number(rule.markup_value);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Invalid markup value on pricing rule.");
  }

  let amount: number;
  switch (rule.markup_type) {
    case "fixed":
      amount = base + value;
      break;
    case "percentage":
      amount = base + (base * value) / 100;
      break;
    case "selling_price":
      amount = value;
      break;
    default:
      throw new Error("Unsupported markup type.");
  }

  amount = roundMoney(amount);

  if (rule.min_amount != null && Number.isFinite(Number(rule.min_amount))) {
    amount = Math.max(amount, roundMoney(Number(rule.min_amount)));
  }
  if (rule.max_amount != null && Number.isFinite(Number(rule.max_amount))) {
    amount = Math.min(amount, roundMoney(Number(rule.max_amount)));
  }

  amount = roundMoney(amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Calculated price is invalid.");
  }
  return amount;
}

/**
 * Specificity score (higher = more specific):
 * 3 = service + provider + product_code
 * 2 = service + provider
 * 1 = service only
 * 0 = does not match
 */
export function ruleSpecificity(
  rule: PricingRuleRow,
  service: PricingService,
  provider: string | null,
  productCode: string | null,
): number {
  if (rule.service !== service) return 0;
  if (!rule.is_active) return 0;

  const ruleProvider = norm(rule.provider);
  const ruleProduct = norm(rule.product_code);
  const p = norm(provider);
  const code = norm(productCode);

  // Product-level: rule has product_code — must match
  if (ruleProduct != null) {
    if (code == null || ruleProduct !== code) return 0;
    // product rules should also align on provider when rule specifies one
    if (ruleProvider != null && (p == null || ruleProvider !== p)) return 0;
    return 3;
  }

  // Provider-level: rule has provider, no product
  if (ruleProvider != null) {
    if (p == null || ruleProvider !== p) return 0;
    return 2;
  }

  // Service-level default
  return 1;
}

/**
 * Pick the best matching active rule.
 * Order: highest specificity, then highest priority, then stable by id.
 */
export function selectMatchingRule(
  rules: PricingRuleRow[],
  service: PricingService,
  provider?: string | null,
  productCode?: string | null,
): PricingRuleRow | null {
  let best: PricingRuleRow | null = null;
  let bestSpec = 0;
  let bestPriority = Number.NEGATIVE_INFINITY;

  for (const rule of rules) {
    if (!rule.is_active) continue;
    if (!SERVICES.has(rule.service) || !MARKUP_TYPES.has(rule.markup_type)) continue;

    const spec = ruleSpecificity(rule, service, provider ?? null, productCode ?? null);
    if (spec === 0) continue;

    const pri = Number(rule.priority) || 0;
    if (
      spec > bestSpec ||
      (spec === bestSpec && pri > bestPriority) ||
      (spec === bestSpec && pri === bestPriority && best != null && rule.id < best.id)
    ) {
      best = rule;
      bestSpec = spec;
      bestPriority = pri;
    }
  }

  return best;
}

/**
 * Pure pricing application. Pass rules from DB or tests.
 * Never accepts a client-supplied final price.
 */
export function applyPricingRule(
  input: ApplyPricingInput,
  rules: PricingRuleRow[],
): ApplyPricingResult {
  if (!SERVICES.has(input.service)) {
    throw new Error("Unsupported service for pricing.");
  }

  const baseAmount = assertValidBase(input.baseAmount);
  const provider = norm(input.provider ?? null);
  const productCode = norm(input.productCode ?? null);

  const rule = selectMatchingRule(rules, input.service, provider, productCode);

  if (!rule) {
    return {
      baseAmount,
      customerAmount: baseAmount,
      rockpayFee: 0,
      pricingRuleId: null,
      markupType: null,
      markupValue: null,
      usedFallback: true,
    };
  }

  const customerAmount = computeFromRule(rule, baseAmount);
  const rockpayFee = roundMoney(customerAmount - baseAmount);

  return {
    baseAmount,
    customerAmount,
    rockpayFee,
    pricingRuleId: rule.id,
    markupType: rule.markup_type,
    markupValue: Number(rule.markup_value),
    usedFallback: false,
  };
}

/**
 * Load active rules for a service using the trusted server admin client (bypasses RLS).
 * Safe for server handlers only.
 */
export async function loadActivePricingRules(service: PricingService): Promise<PricingRuleRow[]> {
  if (!SERVICES.has(service)) return [];

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Table not yet in generated Database types — query untyped.
  const { data, error } = await (supabaseAdmin as any)
    .from("pricing_rules")
    .select(
      "id, service, provider, product_code, markup_type, markup_value, min_amount, max_amount, is_active, priority",
    )
    .eq("service", service)
    .eq("is_active", true);

  if (error) {
    console.error("[pricing] loadActivePricingRules", error.message);
    throw new Error("Could not load pricing rules.");
  }

  const rows = (data ?? []) as PricingRuleRow[];
  return rows.map((r) => ({
    ...r,
    service: r.service as PricingService,
    markup_type: r.markup_type as MarkupType,
    markup_value: Number(r.markup_value),
    min_amount: r.min_amount != null ? Number(r.min_amount) : null,
    max_amount: r.max_amount != null ? Number(r.max_amount) : null,
    priority: Number(r.priority) || 0,
    is_active: Boolean(r.is_active),
  }));
}

/**
 * Resolve customer price: load rules from DB then apply.
 * Use this from payment server functions later.
 */
export async function resolvePricing(input: ApplyPricingInput): Promise<ApplyPricingResult> {
  const rules = await loadActivePricingRules(input.service);
  return applyPricingRule(input, rules);
}
