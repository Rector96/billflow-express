/**
 * Server-only Paystack helpers. Secret never leaves this module.
 * Accepts sk_test_ and sk_live_ (set matching public key on the client).
 */

export const PAYSTACK_API = "https://api.paystack.co";

export function getPaystackSecret(): string {
  const key = (process.env[["PAYSTACK", "SECRET", "KEY"].join("_")] ?? "").trim();
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
  status?: string;
  reference?: string;
  amount?: number;
  requested_amount?: number;
  fees?: number;
  currency?: string;
  gateway_response?: string;
  paid_at?: string | null;
  channel?: string;
};

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

/** Validate the deposit amount separately from a Paystack fee passed to the payer. */
export function matchesPaystackFundingAmount(input: {
  expectedSubunits: number;
  actualSubunits: number;
  requestedSubunits?: number;
  feeSubunits?: number;
}): boolean {
  const { expectedSubunits, actualSubunits } = input;
  const requestedSubunits = Number(input.requestedSubunits);
  const feeSubunits = Number(input.feeSubunits);

  if (actualSubunits === expectedSubunits) return true;

  return (
    requestedSubunits === expectedSubunits &&
    Number.isFinite(feeSubunits) &&
    feeSubunits >= 0 &&
    actualSubunits === requestedSubunits + feeSubunits
  );
}

/**
 * Wallet funding settlement only. Hub payments are not wallet_transactions rows —
 * unknown funding reference is expected for hub-only charges.
 */
export async function verifyAndSettle(reference: string): Promise<SettleResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error: rowError } = await supabaseAdmin
    .from("wallet_transactions")
    .select("reference, amount, status, balance_after, metadata")
    .eq("provider", "paystack")
    .eq("provider_reference", reference)
    .limit(1);
  if (rowError) throw new Error(rowError.message);
  const row = rows?.[0];
  if (!row) throw new Error("Unknown funding reference.");

  if (row.status === "successful") {
    return {
      status: "successful",
      amount: Number(row.amount),
      balanceAfter: row.balance_after === null ? null : Number(row.balance_after),
      credited: false,
    };
  }

  const data = await paystackVerify(reference);
  if (!data) {
    return { status: "pending", amount: Number(row.amount), balanceAfter: null, credited: false };
  }

  const expectedSubunits = Math.round(Number(row.amount) * 100);
  const actualSubunits = Number(data.amount);
  const requestedSubunits = Number(data.requested_amount);
  const feeSubunits = Number(data.fees);
  const gatewayStatus = String(data.status ?? "").toLowerCase();

  // Paystack fee pass-through can make the customer's total (amount) greater
  // than the intended deposit. Accept that only when Paystack explicitly
  // reports the expected requested_amount and the total exactly equals
  // requested_amount + fees. Never credit the fee to the wallet.
  const amountMatches = matchesPaystackFundingAmount({
    expectedSubunits,
    actualSubunits,
    requestedSubunits,
    feeSubunits,
  });

  if (gatewayStatus === "success") {
    if (
      data.currency !== "NGN" ||
      !amountMatches ||
      data.reference !== reference
    ) {
      console.error("[paystack] wallet funding validation mismatch", {
        reference,
        expectedSubunits,
        actualSubunits: Number.isFinite(actualSubunits) ? actualSubunits : null,
        requestedSubunits: Number.isFinite(requestedSubunits) ? requestedSubunits : null,
        feeSubunits: Number.isFinite(feeSubunits) ? feeSubunits : null,
        currency: data.currency ?? null,
        referenceMatches: data.reference === reference,
      });
      const { error } = await supabaseAdmin.rpc("settle_paystack_funding", {
        _reference: reference,
        _status: "failed",
        _payload: {
          reason: "validation_mismatch",
          gateway_status: gatewayStatus,
          expected_subunits: expectedSubunits,
          actual_subunits: Number.isFinite(actualSubunits) ? actualSubunits : null,
          requested_subunits: Number.isFinite(requestedSubunits) ? requestedSubunits : null,
          fee_subunits: Number.isFinite(feeSubunits) ? feeSubunits : null,
          currency: data.currency ?? null,
        },
      });
      if (error) throw new Error(error.message);
      return { status: "failed", amount: Number(row.amount), balanceAfter: null, credited: false };
    }

    const providerTransactionId = data.id ? String(data.id) : "";
    const paystackMetadata = (row.metadata as { paystack?: { reason?: string } } | null)?.paystack;
    const wasValidationMismatch =
      row.status === "failed" &&
      paystackMetadata?.reason === "validation_mismatch";

    if (wasValidationMismatch) {
      // Recover only the previously rejected fee-inclusive case. A fresh
      // Paystack verification above must prove the reference, NGN currency,
      // requested deposit and exact fee-inclusive charged total.
      const verifiedFeeInclusive =
        Boolean(providerTransactionId) &&
        requestedSubunits === expectedSubunits &&
        Number.isFinite(feeSubunits) &&
        feeSubunits >= 0 &&
        actualSubunits === requestedSubunits + feeSubunits;

      if (!verifiedFeeInclusive) {
        throw new Error("Previously failed funding requires a verified fee-inclusive Paystack amount breakdown.");
      }

      const { data: recovered, error: recoveryError } = await supabaseAdmin.rpc("recover_paystack_funding", {
        _reference: reference,
        _requested_subunits: requestedSubunits,
        _charged_subunits: actualSubunits,
        _fee_subunits: feeSubunits,
        _provider_transaction_id: providerTransactionId,
        _payload: {
          gateway_status: gatewayStatus,
          currency: data.currency,
          reference_match: data.reference === reference,
          channel: data.channel ?? null,
          paid_at: data.paid_at ?? null,
          gateway_response: data.gateway_response ?? null,
        },
      });
      if (recoveryError) throw new Error(recoveryError.message);
      const recoveredRow = Array.isArray(recovered) ? recovered[0] : recovered;
      return {
        status: "successful",
        amount: Number(row.amount),
        balanceAfter: recoveredRow?.balance_after != null ? Number(recoveredRow.balance_after) : null,
        credited: Boolean(recoveredRow?.credited),
      };
    }

    const { data: credit, error } = await supabaseAdmin.rpc("complete_paystack_funding", {
      _reference: reference,
      _paid_amount: Number(row.amount),
      _provider_transaction_id: providerTransactionId,
      _payload: {
        channel: data.channel ?? null,
        paid_at: data.paid_at ?? null,
        gateway_response: data.gateway_response ?? null,
        requested_amount_subunits: Number.isFinite(requestedSubunits) ? requestedSubunits : null,
        charged_amount_subunits: Number.isFinite(actualSubunits) ? actualSubunits : null,
        fee_subunits: Number.isFinite(feeSubunits) ? feeSubunits : null,
      },
    });
    if (error) throw new Error(error.message);
    const result = Array.isArray(credit) ? credit[0] : credit;
    return {
      status: "successful",
      amount: Number(row.amount),
      balanceAfter: result?.balance_after != null ? Number(result.balance_after) : null,
      credited: Boolean(result?.credited),
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
  return { status: nextStatus, amount: Number(row.amount), balanceAfter: null, credited: false };
}
