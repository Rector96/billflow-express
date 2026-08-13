import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InitFundingResult = {
  reference: string;
  authorizationUrl: string;
  amount: number;
};

/**
 * Starts a Paystack (test mode) wallet top-up for the signed-in user.
 * The amount is validated in the database, the ledger row is created as
 * PENDING, and Paystack is initialized server-side with the secret key.
 */
export const initializeWalletFunding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number }) => {
    const amount = Math.round(Number(input?.amount));
    if (!Number.isFinite(amount) || amount < 100 || amount > 1000000) {
      throw new Error("Enter an amount between ₦100 and ₦1,000,000.");
    }
    return { amount };
  })
  .handler(async ({ data, context }): Promise<InitFundingResult> => {
    const { getPaystackSecret, PAYSTACK_API } = await import("./paystack.server");

    // The wallet + email come from the authenticated session, never the client.
    const { data: intent, error } = await context.supabase.rpc("create_wallet_funding_intent", {
      _amount: data.amount,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(intent) ? intent[0] : intent;
    if (!row?.reference || !row.email) throw new Error("Could not start this top-up.");

    const origin = getRequestHeader("origin") ?? getRequestHeader("referer")?.replace(/\/[^/]*$/, "");
    const callbackUrl = origin ? `${origin}/wallet/fund` : undefined;

    const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getPaystackSecret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: row.email,
        amount: Math.round(Number(row.amount) * 100), // NGN -> kobo
        currency: "NGN",
        reference: row.reference,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        metadata: {
          internal_reference: row.reference,
          user_id: context.userId,
          purpose: "wallet_funding",
          mode: "test",
        },
      }),
    });
    const json = (await res.json().catch(() => null)) as
      | { status?: boolean; message?: string; data?: { authorization_url?: string } }
      | null;

    if (!res.ok || !json?.status || !json.data?.authorization_url) {
      await context.supabase.rpc("create_wallet_funding_intent", { _amount: 0 }).catch(() => null);
      throw new Error(json?.message ?? "Paystack could not start this payment.");
    }

    return {
      reference: row.reference,
      authorizationUrl: json.data.authorization_url,
      amount: Number(row.amount),
    };
  });

export type FundingStatus = {
  reference: string;
  status: "successful" | "pending" | "failed";
  amount: number;
};

/**
 * Verifies a Paystack reference server-side and settles the ledger.
 * The browser can never mark a transaction successful — this only reports the
 * outcome of the server-side verification.
 */
export const verifyWalletFunding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    const reference = String(input?.reference ?? "").trim();
    if (!/^WAL-[A-Z0-9]{4,32}$/.test(reference)) throw new Error("Invalid reference.");
    return { reference };
  })
  .handler(async ({ data, context }): Promise<FundingStatus> => {
    // Ownership check under RLS: the caller must own this ledger row.
    const { data: owned, error } = await context.supabase
      .from("wallet_transactions")
      .select("reference")
      .eq("provider", "paystack")
      .eq("provider_reference", data.reference)
      .eq("user_id", context.userId)
      .limit(1);
    if (error) throw new Error(error.message);
    if (!owned?.length) throw new Error("Transaction not found.");

    const { verifyAndSettle } = await import("./paystack.server");
    const result = await verifyAndSettle(data.reference);
    return { reference: data.reference, status: result.status, amount: result.amount };
  });
