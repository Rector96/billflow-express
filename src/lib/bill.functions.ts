import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SecureBillInput = {
  service: string;
  provider: string;
  product?: string;
  amount: number;
  customerIdentifier: string;
  status: "successful" | "pending" | "failed";
  metadata?: Record<string, unknown>;
  pin: string;
};

export type SecureBillResult = {
  billId: string;
  internalReference: string;
  balanceAfter: number;
};

/**
 * Permanently disabled. Live payments must use VTpass server functions
 * (purchaseAirtime, purchaseData, purchaseCable, purchaseElectricity, exam pins).
 * The old secure_bill_payment RPC created demo ledger rows without provider settlement.
 */
export const secureBillPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SecureBillInput) => {
    const pin = String(input?.pin ?? "").trim();
    if (!/^[0-9]{4}$/.test(pin)) throw new Error("Enter a valid 4-digit PIN.");
    return input;
  })
  .handler(async (): Promise<SecureBillResult> => {
    throw new Error(
      "Demo secure_bill_payment is disabled. Use VTpass purchase server functions.",
    );
  });
