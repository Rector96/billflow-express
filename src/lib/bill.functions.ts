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
 * Authorizes a bill payment with a server-side PIN check, then moves funds.
 * PIN is never trusted from the client alone — the database verifies the hash.
 */
export const secureBillPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SecureBillInput) => {
    const pin = String(input?.pin ?? "").trim();
    if (!/^[0-9]{4}$/.test(pin)) throw new Error("Enter a valid 4-digit PIN.");
    const amount = Math.round(Number(input?.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount.");
    const status = input?.status;
    if (status !== "successful" && status !== "pending" && status !== "failed") {
      throw new Error("Invalid status.");
    }
    return {
      service: String(input?.service ?? "").trim(),
      provider: String(input?.provider ?? "").trim(),
      product: String(input?.product ?? ""),
      amount,
      customerIdentifier: String(input?.customerIdentifier ?? "").trim(),
      status,
      metadata: (input?.metadata ?? {}) as Record<string, unknown>,
      pin,
    };
  })
  .handler(async ({ data, context }): Promise<SecureBillResult> => {
    const { data: rows, error } = await context.supabase.rpc("secure_bill_payment", {
      _service: data.service,
      _provider: data.provider,
      _product: data.product,
      _amount: data.amount,
      _customer_identifier: data.customerIdentifier,
      _status: data.status,
      _metadata: data.metadata,
      _pin: data.pin,
    });
    if (error) {
      if (error.message.includes("pin_locked")) {
        throw new Error("PIN temporarily locked after too many failed attempts. Try again later.");
      }
      if (error.message.includes("pin_not_set")) {
        throw new Error("Set a transaction PIN in Security before paying.");
      }
      if (error.message.includes("invalid_pin")) {
        throw new Error("Incorrect PIN.");
      }
      if (error.message.includes("insufficient_funds")) {
        throw new Error("insufficient_funds");
      }
      throw new Error(error.message);
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.internal_reference) throw new Error("Payment could not be completed.");
    return {
      billId: String(row.bill_id ?? ""),
      internalReference: String(row.internal_reference),
      balanceAfter: Number(row.balance_after ?? 0),
    };
  });
