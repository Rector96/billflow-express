import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InitFundingResult =
  | { status: "ready"; reference: string; authorizationUrl: string; amount: number }
  | { status: "pending"; reference: string; amount: number; message: string };

function resolveCallbackUrl(): string | undefined {
  // Prefer explicit site URL (set on Netlify), then Origin, then Referer.
  const siteUrl = (
    process.env["URL"] ??
    process.env["DEPLOY_PRIME_URL"] ??
    process.env["SITE_URL"] ??
    ""
  )
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
      return {
        status: "pending",
        reference: row.reference,
        amount: Number(row.amount),
        message:
          "Your funding reference was created, but checkout could not start because your account email is missing. Contact RockPay Care before trying again.",
      };
    }

    const callbackUrl = resolveCallbackUrl();
    if (!callbackUrl) {
      console.warn("[paystack] no callback URL resolved; Paystack will use dashboard default");
    }

    try {
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
      const json = (await res.json().catch(() => null)) as {
        status?: boolean;
        message?: string;
        data?: { authorization_url?: string };
      } | null;

      if (!res.ok || !json?.status || !json.data?.authorization_url) {
        const msg = json?.message ?? `Paystack initialize failed (HTTP ${res.status})`;
        console.error("[paystack] initialize", res.status, msg, row.reference);
        return {
          status: "pending",
          reference: row.reference,
          amount: Number(row.amount),
          message:
            "We couldn't confirm that checkout started. Your funding reference has been saved. Check its status before starting another top-up.",
        };
      }

      return {
        status: "ready",
        reference: row.reference,
        authorizationUrl: json.data.authorization_url,
        amount: Number(row.amount),
      };
    } catch (error) {
      console.error("[paystack] initialize request outcome unknown", {
        reference: row.reference,
        message: error instanceof Error ? error.message : "Unknown network error",
      });
      return {
        status: "pending",
        reference: row.reference,
        amount: Number(row.amount),
        message:
          "Checkout could not be confirmed because of a connection problem. We saved your funding reference; verify its status before trying another top-up.",
      };
    }
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

/**
 * Staff-only reconciliation for an existing Paystack wallet deposit.
 * Paystack verification and the established atomic settlement RPCs remain
 * the only path that can credit a wallet; this action never writes balances.
 */
export const recheckWalletFunding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    const reference = String(input?.reference ?? "").trim();
    if (!/^WAL-[A-Z0-9]{4,32}$/.test(reference)) {
      throw new Error("Invalid wallet funding reference.");
    }
    return { reference };
  })
  .handler(
    async ({ data, context }): Promise<FundingStatus & { credited: boolean; auditId?: string }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Reconciliation can result in a wallet credit, so enforce the existing
      // wallet-adjustment privilege boundary rather than allowing view-only support staff.
      const { data: roles, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      if (roleError) throw new Error("Could not verify staff permissions.");
      if (!(roles ?? []).some((entry) => entry.role === "super_admin")) {
        throw new Error("Forbidden: super admin access required for wallet funding rechecks.");
      }

      const { data: rows, error } = await supabaseAdmin
        .from("wallet_transactions")
        .select("reference, amount, status, type, provider")
        .eq("reference", data.reference)
        .eq("provider", "paystack")
        .eq("provider_reference", data.reference)
        .limit(1);
      if (error) throw new Error(error.message);
      const row = rows?.[0];
      if (!row || row.type !== "deposit") throw new Error("Paystack wallet deposit not found.");

      const amount = Number(row.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Stored wallet deposit amount is invalid.");
      }

      if (row.status === "successful") {
        return { reference: data.reference, status: "successful", amount, credited: false };
      }
      if (row.status !== "pending" && row.status !== "failed") {
        throw new Error("This wallet transaction is not eligible for recheck.");
      }

      // Create the audit record before calling Paystack. If the audit store is
      // unavailable, fail closed and do not perform a money-affecting recheck.
      const { data: actorResult } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const actorEmail = actorResult.user?.email ?? null;
      const { data: audit, error: auditError } = await supabaseAdmin
        .from("admin_audit_logs")
        .insert({
          actor_user_id: context.userId,
          action: "wallet_funding_recheck",
          target_type: "wallet_transaction",
          target_id: data.reference,
          description: "Paystack wallet funding recheck started",
          metadata: {
            outcome: "started",
            actor_email: actorEmail,
            provider: "paystack",
            wallet_amount_ngn: amount,
          },
        })
        .select("id")
        .single();
      if (auditError || !audit?.id) {
        throw new Error("Could not create the required wallet recheck audit record.");
      }

      let settlementCompleted = false;
      let settledResult: import("./paystack.server").SettleResult | null = null;
      try {
        // This function verifies Paystack and invokes only the established
        // complete_paystack_funding / recover_paystack_funding settlement RPCs.
        const { verifyAndSettle } = await import("./paystack.server");
        const result = await verifyAndSettle(data.reference);
        settlementCompleted = true;
        settledResult = result;
        const auditMetadata = {
          outcome: result.status,
          credited: result.credited,
          wallet_amount_ngn: result.amount,
          paystack: result.paystack ?? null,
        };
        const { error: updateAuditError } = await supabaseAdmin
          .from("admin_audit_logs")
          .update({
            description: result.credited
              ? "Paystack wallet recheck verified and wallet credited"
              : "Paystack wallet recheck completed without a new wallet credit",
            metadata: {
              ...auditMetadata,
              actor_email: actorEmail,
              provider: "paystack",
            },
          })
          .eq("id", audit.id);
        if (updateAuditError) {
          console.error("[wallet-recheck] audit completion update failed", {
            auditId: audit.id,
            reference: data.reference,
            message: updateAuditError.message,
          });
          throw new Error(
            "Recheck completed, but its audit record could not be finalized. Check the Admin audit log before retrying.",
          );
        }
        return {
          reference: data.reference,
          status: result.status,
          amount: result.amount,
          credited: result.credited,
          auditId: audit.id,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown recheck error";
        const failureMetadata =
          settlementCompleted && settledResult
            ? {
                outcome: "audit_update_failed_after_settlement",
                actor_email: actorEmail,
                provider: "paystack",
                credited: settledResult.credited,
                wallet_amount_ngn: settledResult.amount,
                paystack: settledResult.paystack ?? null,
                error_message: message.slice(0, 300),
              }
            : {
                outcome: "error",
                actor_email: actorEmail,
                provider: "paystack",
                error_message: message.slice(0, 300),
              };
        const { error: auditUpdateError } = await supabaseAdmin
          .from("admin_audit_logs")
          .update({
            description: settlementCompleted
              ? "Wallet settlement completed but audit finalization needs attention"
              : "Paystack wallet funding recheck encountered an error",
            metadata: failureMetadata,
          })
          .eq("id", audit.id);
        if (auditUpdateError) {
          console.error("[wallet-recheck] failed to record recheck outcome", {
            auditId: audit.id,
            reference: data.reference,
            message: auditUpdateError.message,
          });
        }
        throw error;
      }
    },
  );
