/**
 * Server-only Paystack helpers. Secret never leaves this module.
 * Accepts sk_test_ and sk_live_ (set matching public key on the client).
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
  status?: string;
  reference?: string;
  amount?: number;
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

/**
 * Wallet funding settlement only. Hub payments are not wallet_transactions rows —
 * unknown funding reference is expected for hub-only charges.
 */
export async function verifyAndSettle(reference: string): Promise<SettleResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error: rowError } = await supabaseAdmin
    .from("wallet_transactions")
    .select("reference, amount, status, balance_after")
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
  const gatewayStatus = String(data.status ?? "").toLowerCase();

  if (gatewayStatus === "success") {
    if (
      data.currency !== "NGN" ||
      Number(data.amount) !== expectedSubunits ||
      data.reference !== reference
    ) {
      const { error } = await supabaseAdmin.rpc("settle_paystack_funding", {
        _reference: reference,
        _status: "failed",
        _payload: { reason: "validation_mismatch", gateway_status: gatewayStatus },
      });
      if (error) throw new Error(error.message);
      return { status: "failed", amount: Number(row.amount), balanceAfter: null, credited: false };
    }

    const { data: credit, error } = await supabaseAdmin.rpc("complete_paystack_funding", {
      _reference: reference,
      _paid_amount: Number(row.amount),
      _provider_transaction_id: data.id ? String(data.id) : "",
      _payload: {
        channel: data.channel ?? null,
        paid_at: data.paid_at ?? null,
        gateway_response: data.gateway_response ?? null,
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
