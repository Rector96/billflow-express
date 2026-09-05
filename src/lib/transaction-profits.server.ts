/**
 * Trusted server-side transaction profit recording.
 *
 * Writes MUST only happen after a provider-backed purchase is confirmed successful.
 * Never accept client-supplied financial values.
 * Idempotent via unique(bill_transaction_id) + ON CONFLICT DO NOTHING.
 *
 * Backfill (trusted_backfill_transaction_profit_costs) only fills NULL cost/commission/profit
 * on existing rows — never overwrites non-NULL values and never invents economics.
 */

export type ProfitService = "airtime" | "data" | "cable" | "electricity";

export type RecordProfitInput = {
  internalReference: string;
  customerAmount: number;
  providerAmount: number | null;
  rockpayFee: number | null;
  pricingRuleId: string | null;
  service: ProfitService;
  provider: string | null;
  productCode: string | null;
  /** Only set when VTpass cost is reliably known — otherwise leave null */
  providerCost?: number | null;
  providerCommission?: number | null;
};

export type BackfillProfitInput = {
  internalReference: string;
  providerCost?: number | null;
  providerCommission?: number | null;
};

export type BackfillProfitResult = {
  updated: boolean;
  alreadyComplete: boolean;
  reason: string;
  id?: string | null;
};

type SupabaseLike = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function roundMoney(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Normalize a money input for backfill: finite and >= 0 → rounded number; else null.
 * Never invents a value from missing input.
 */
export function sanitizeBackfillMoney(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundMoney(n);
}

/**
 * Pure preview of NULL-only backfill rules (mirrors SQL COALESCE behavior).
 * Used by unit tests; the authoritative write path is the SQL RPC.
 */
export function planNullOnlyBackfill(args: {
  existingCost: number | null;
  existingCommission: number | null;
  existingProfit: number | null;
  customerAmount: number;
  suppliedCost: number | null;
  suppliedCommission: number | null;
}): {
  nextCost: number | null;
  nextCommission: number | null;
  nextProfit: number | null;
  wouldUpdate: boolean;
} {
  const nextCost = args.existingCost != null ? args.existingCost : args.suppliedCost;
  const nextCommission =
    args.existingCommission != null ? args.existingCommission : args.suppliedCommission;

  let nextProfit: number | null;
  if (args.existingProfit != null) {
    nextProfit = args.existingProfit;
  } else if (nextCost != null && Number.isFinite(args.customerAmount)) {
    nextProfit = roundMoney(args.customerAmount - nextCost);
  } else {
    nextProfit = null;
  }

  const wouldUpdate =
    nextCost !== args.existingCost ||
    nextCommission !== args.existingCommission ||
    nextProfit !== args.existingProfit;

  return { nextCost, nextCommission, nextProfit, wouldUpdate };
}

/**
 * Pure decision: should we record profit for this outcome?
 */
export function shouldRecordProfit(status: string | null | undefined): boolean {
  return status === "successful";
}

/**
 * Pure decision: compute profit only when provider_cost is known.
 * Never infer profit from rockpay_fee alone.
 */
export function computeProfit(
  customerAmount: number,
  providerCost: number | null | undefined,
): number | null {
  if (providerCost == null || !Number.isFinite(providerCost)) return null;
  if (!Number.isFinite(customerAmount)) return null;
  return roundMoney(customerAmount - providerCost);
}

/**
 * Record profit for a successful bill transaction.
 * Looks up bill_transactions by internal_reference, then inserts via SECURITY DEFINER RPC.
 * Safe to call multiple times (idempotent).
 */
export async function maybeRecordTransactionProfit(
  supabase: SupabaseLike,
  input: RecordProfitInput,
): Promise<{ recorded: boolean; reason?: string }> {
  const customerAmount = roundMoney(input.customerAmount);
  if (!Number.isFinite(customerAmount) || customerAmount < 0) {
    return { recorded: false, reason: "invalid_customer_amount" };
  }
  if (!input.internalReference?.trim()) {
    return { recorded: false, reason: "missing_reference" };
  }

  const providerCost =
    input.providerCost != null && Number.isFinite(input.providerCost)
      ? roundMoney(input.providerCost)
      : null;
  const providerCommission =
    input.providerCommission != null && Number.isFinite(input.providerCommission)
      ? roundMoney(input.providerCommission)
      : null;
  const rockpayFee =
    input.rockpayFee != null && Number.isFinite(input.rockpayFee)
      ? roundMoney(input.rockpayFee)
      : null;
  const profit = computeProfit(customerAmount, providerCost);

  const { data, error } = await supabase.rpc("trusted_record_transaction_profit", {
    _internal_reference: input.internalReference.trim(),
    _customer_amount: customerAmount,
    _provider_cost: providerCost,
    _provider_commission: providerCommission,
    _rockpay_fee: rockpayFee,
    _profit: profit,
    _pricing_rule_id: input.pricingRuleId,
    _service: input.service,
    _provider: input.provider,
    _product_code: input.productCode,
    _provider_amount: input.providerAmount != null ? roundMoney(input.providerAmount) : null,
  });

  if (error) {
    if (
      error.message.includes("duplicate") ||
      error.message.includes("unique") ||
      error.message.includes("already_recorded")
    ) {
      return { recorded: false, reason: "already_recorded" };
    }
    console.error("[profit] record_transaction_profit", error.message);
    return { recorded: false, reason: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.already_recorded) {
    return { recorded: false, reason: "already_recorded" };
  }
  return { recorded: true };
}

/**
 * NULL-only repair of provider_cost / provider_commission / profit on an existing
 * transaction_profits row for a successful bill. Does not insert a new row.
 * Never overwrites non-NULL economics. Never invents values.
 */
export async function backfillTransactionProfitCosts(
  supabase: SupabaseLike,
  input: BackfillProfitInput,
): Promise<BackfillProfitResult> {
  const reference = input.internalReference?.trim() ?? "";
  if (!reference) {
    return { updated: false, alreadyComplete: false, reason: "missing_reference" };
  }

  const providerCost = sanitizeBackfillMoney(input.providerCost);
  const providerCommission = sanitizeBackfillMoney(input.providerCommission);

  if (providerCost == null && providerCommission == null) {
    return { updated: false, alreadyComplete: false, reason: "no_values_supplied" };
  }

  const { data, error } = await supabase.rpc("trusted_backfill_transaction_profit_costs", {
    _internal_reference: reference,
    _provider_cost: providerCost,
    _provider_commission: providerCommission,
  });

  if (error) {
    if (error.message.includes("not_successful")) {
      return { updated: false, alreadyComplete: false, reason: "not_successful" };
    }
    if (error.message.includes("forbidden")) {
      return { updated: false, alreadyComplete: false, reason: "forbidden" };
    }
    console.error("[profit] backfill_transaction_profit_costs", error.message);
    return { updated: false, alreadyComplete: false, reason: error.message };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        id?: string | null;
        updated?: boolean;
        already_complete?: boolean;
        reason?: string;
      }
    | null
    | undefined;

  return {
    updated: Boolean(row?.updated),
    alreadyComplete: Boolean(row?.already_complete),
    reason: String(row?.reason ?? "unknown"),
    id: row?.id ?? null,
  };
}
