import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InitFundingResult = {
  reference: string;
  authorizationUrl: string;
  amount: number;
};

function resolveCallbackUrl(): string | undefined {
  // Prefer explicit site URL (set on Netlify), then Origin, then Referer.
  const siteUrl = (process.env["URL"] ?? process.env["DEPLOY_PRIME_URL"] ?? process.env["SITE_URL"] ?? "")
    .trim()
    .replace(/\/$/, "");
  if (siteUrl.startsWith("http")) return `${siteUrl}/wallet/fund`;

  const origin = getRequestHeader("origin")?.trim();
  if (origin?.startsWith("http")) return `${origin.replace(/\/$/, "")}/wallet/fund`;

  const referer = getRequestHeader("referer")?.trim();
  if (referer?.startsWith("http")) {
    try {
      const u = new URL(referer);
      return `${u.origin}/wallet/fund`;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

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

    // Fail fast if secret is missing — clearer than a vague Paystack API error.
    const secret = getPaystackSecret();

    // The wallet + email come from the authenticated session, never the client.
    const { data: intent, error } = await context.supabase.rpc("create_wallet_funding_intent", {
      _amount: data.amount,
    });
    if (error) {
      console.error("[paystack] create_wallet_funding_intent", error.message);
      throw new Error(error.message);
    }
    const row = Array.isArray(intent) ? intent[0] : intent;
    if (!row?.reference) {
      throw new Error("Could not create funding intent (no reference returned).");
    }
    if (!row.email) {
      throw new Error(
        "Your account has no email on file. Update your profile email, then try Fund Wallet again.",
      );
    }

    const callbackUrl = resolveCallbackUrl();
    if (!callbackUrl) {
      console.warn("[paystack] no callback URL resolved; Paystack will use dashboard default");
    }

    const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
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
      const msg = json?.message ?? `Paystack initialize failed (HTTP ${res.status})`;
      console.error("[paystack] initialize", res.status, msg);
      throw new Error(msg);
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
