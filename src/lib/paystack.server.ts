/**
 * Server-only Paystack helpers. Secret never leaves this module.
 * Accepts sk_test_ and sk_live_ keys; transaction domain is checked against the key.
 */

export const PAYSTACK_API = "https://api.paystack.co";

export function getPaystackSecret(): string {
  const key = (process.env["PAYSTACK_SECRET_KEY"] ?? "").trim();
  if (!key) {
    throw new Error(
      "Paystack is not configured. Set PAYSTACK_SECRET_KEY (sk_test_... or sk_live_...) in Netlify and redeploy.",
    );
  }
  if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    throw new Error("Invalid Paystack secret key. Expected sk_test_... or sk_live_...");
  }
  return key;
}

type PaystackVerifyData = {
  id?: number | string;
  domain?: string;
  status?: string;
  reference?: string;
  amount?: number;
  requested_amount?: number;
  fees?: number | null;
  currency?: string;
  gateway_response?: string;
  paid_at?: string | null;
  paidAt?: string | null;
  channel?: string;
};

type FundingClassification =
  | { kind: "standard"; providerTransactionId: string }
  | {
      kind: "fee_inclusive";
      providerTransactionId: string;
      requestedSubunits: number;
      chargedSubunits: number;
      feeSubunits: number;
    }
  | { kind: "mismatch"; reason: string };

/**
 * Paystack's verify response reports amount (the total charge), requested_amount
 * (the amount requested by the merchant), and fees (the difference). A bank
 * transfer can therefore have amount > requested_amount without being an
 * under/over-payment. Only accept that case when all three values reconcile.
 */
export function classifyPaystackFunding(
  data: PaystackVerifyData,
  reference: string,
  expectedSubunits: number,
): FundingClassification {
  if (data.reference !== reference) return { kind: "mismatch", reason: "reference_mismatch" };
  if (data.currency !== "NGN") return { kind: "mismatch", reason: "currency_mismatch" };

  const id =
    typeof data.id === "number"
      ? Number.isSafeInteger(data.id) && data.id > 0
        ? String(data.id)
        : ""
      : typeof data.id === "string" && /^\d+$/.test(data.id) && BigInt(data.id) > 0n
        ? data.id
        : "";
  if (!id) return { kind: "mismatch", reason: "missing_provider_transaction_id" };

  const charged = data.amount;
  if (!Number.isSafeInteger(charged) || Number(charged) <= 0) {
    return { kind: "mismatch", reason: "invalid_charged_amount" };
  }

  const requested = data.requested_amount == null ? null : Number(data.requested_amount);
  const fees = data.fees == null ? null : Number(data.fees);

  // Normal Paystack charge: the transaction amount equals the wallet amount.
  if (Number(charged) === expectedSubunits) {
    if (requested !== null && requested !== expectedSubunits) {
      return { kind: "mismatch", reason: "requested_amount_mismatch" };
    }
    return { kind: "standard", providerTransactionId: id };
  }

  // Fee-inclusive bank transfer: only recover when Paystack independently
  // reports the exact requested amount and a fee that reconciles to the charge.
  if (
    requested === expectedSubunits &&
    Number.isSafeInteger(requested) &&
    fees !== null &&
    Number.isSafeInteger(fees) &&
    fees > 0 &&
    Number(charged) === requested + fees
  ) {
    return {
      kind: "fee_inclusive",
      providerTransactionId: id,
      requestedSubunits: requested,
      chargedSubunits: Number(charged),
      feeSubunits: fees,
    };
  }

  return { kind: "mismatch", reason: "amount_mismatch" };
}

export async function paystackVerify(reference: string): Promise<PaystackVerifyData | null> {
  const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${getPaystackSecret()}` },
  });
  const json = (await res.json().catch(() => null)) as {
    status?: boolean;
    data?: PaystackVerifyData;
    message?: string;
  } | null;
  if (!res.ok || !json?.status || !json.data) {
    console.error("[paystack] verify failed", reference, res.status, json?.message ?? json);
    return null;
  }
  return json.data;
}

export type SettleResult = {
  status: "successful" | "pending" | "failed";
  amount: number;
  balanceAfter: number | null;
  credited: boolean;
};

function toRpcRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/**
 * Wallet funding settlement only. Hub payments are not wallet_transactions rows —
 * unknown funding reference is expected for hub-only charges.
 */
export async function verifyAndSettle(reference: string): Promise<SettleResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error: rowError } = await supabaseAdmin
    .from("wallet_transactions")
    .select("reference, amount, status, balance_after, type, metadata")
    .eq("provider", "paystack")
    .eq("provider_reference", reference)
    .limit(1);
  if (rowError) throw new Error(rowError.message);
  const row = rows?.[0];
  if (!row) throw new Error("Unknown funding reference.");

  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid wallet funding amount.");
  if (row.type !== "deposit") throw new Error("Paystack wallet reference is not a deposit.");

  if (row.status === "successful") {
    return {
      status: "successful",
      amount,
      balanceAfter: row.balance_after === null ? null : Number(row.balance_after),
      credited: false,
    };
  }

  const data = await paystackVerify(reference);
  if (!data) {
    return { status: "pending", amount, balanceAfter: null, credited: false };
  }

  const gatewayStatus = String(data.status ?? "").toLowerCase();
  if (gatewayStatus === "success") {
    const key = getPaystackSecret();
    const expectedDomain = key.startsWith("sk_test_") ? "test" : "live";
    if (data.domain && data.domain !== expectedDomain) {
      throw new Error("Paystack transaction domain does not match the configured secret key.");
    }

    const expectedSubunits = Math.round(amount * 100);
    const classification = classifyPaystackFunding(data, reference, expectedSubunits);

    if (classification.kind === "mismatch") {
      const { error } = await supabaseAdmin.rpc("settle_paystack_funding", {
        _reference: reference,
        _status: "failed",
        _payload: {
          reason: "validation_mismatch",
          gateway_status: gatewayStatus,
          validation_reason: classification.reason,
        },
      });
      if (error) throw new Error(error.message);
      return { status: "failed", amount, balanceAfter: null, credited: false };
    }

    if (classification.kind === "standard") {
      const { data: credit, error } = await supabaseAdmin.rpc("complete_paystack_funding", {
        _reference: reference,
        _paid_amount: amount,
        _provider_transaction_id: classification.providerTransactionId,
        _payload: {
          channel: data.channel ?? null,
          paid_at: data.paid_at ?? data.paidAt ?? null,
          gateway_response: data.gateway_response ?? null,
          gateway_status: gatewayStatus,
          currency: data.currency,
          reference_match: true,
        },
      });
      if (error) throw new Error(error.message);
      const result = toRpcRow(credit);
      return {
        status: "successful",
        amount,
        balanceAfter: result?.["balance_after"] != null ? Number(result["balance_after"]) : null,
        credited: Boolean(result?.["credited"]),
      };
    }

    // The recovery RPC intentionally only accepts a failed deposit previously
    // marked with paystack.reason=validation_mismatch. If this is still pending,
    // first record that verified mismatch; retries can then safely resume recovery.
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    const paystackMetadata =
      metadata["paystack"] && typeof metadata["paystack"] === "object"
        ? (metadata["paystack"] as Record<string, unknown>)
        : {};

    if (row.status === "pending") {
      const { error } = await supabaseAdmin.rpc("settle_paystack_funding", {
        _reference: reference,
        _status: "failed",
        _payload: {
          reason: "validation_mismatch",
          gateway_status: gatewayStatus,
          validation_reason: "verified_fee_inclusive_amount_mismatch",
        },
      });
      if (error) throw new Error(error.message);
    } else if (row.status !== "failed" || paystackMetadata["reason"] !== "validation_mismatch") {
      throw new Error("This transaction is not eligible for fee-inclusive recovery.");
    }

    const { data: recovered, error } = await supabaseAdmin.rpc("recover_paystack_funding", {
      _reference: reference,
      _requested_subunits: classification.requestedSubunits,
      _charged_subunits: classification.chargedSubunits,
      _fee_subunits: classification.feeSubunits,
      _provider_transaction_id: classification.providerTransactionId,
      _payload: {
        gateway_status: gatewayStatus,
        currency: data.currency,
        reference_match: data.reference === reference,
        channel: data.channel ?? null,
        paid_at: data.paid_at ?? data.paidAt ?? null,
        gateway_response: data.gateway_response ?? null,
      },
    });
    if (error) throw new Error(error.message);
    const result = toRpcRow(recovered);
    if (!result || result["status"] !== "successful") {
      throw new Error("Paystack recovery did not return a successful settlement.");
    }
    return {
      status: "successful",
      amount: result["amount"] != null ? Number(result["amount"]) : amount,
      balanceAfter: result["balance_after"] != null ? Number(result["balance_after"]) : null,
      credited: Boolean(result["credited"]),
    };
  }

  const nextStatus =
    gatewayStatus === "failed" || gatewayStatus === "abandoned" ? "failed" : "pending";
  const { error } = await supabaseAdmin.rpc("settle_paystack_funding", {
    _reference: reference,
    _status: nextStatus,
    _payload: { gateway_status: gatewayStatus, gateway_response: data.gateway_response ?? null },
  });
  if (error) throw new Error(error.message);
  return { status: nextStatus, amount, balanceAfter: null, credited: false };
}
