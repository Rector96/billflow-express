/**
 * Trusted server-side transaction profit recording.
 *
 * Writes MUST only happen after a provider-backed purchase is confirmed successful.
 * Never accept client-supplied financial values.
 * Idempotent via unique(bill_transaction_id) + ON CONFLICT DO NOTHING.
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

type SupabaseLike = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function roundMoney(n: number): number {
  return Math.round(Number(n) * 100) / 100;
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

  const { data, error } = await supabase.rpc("record_transaction_profit", {
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
