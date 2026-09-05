import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function assertFourDigitPin(pin: string) {
  const value = String(pin ?? "").trim();
  if (!/^[0-9]{4}$/.test(value)) {
    throw new Error("Enter a valid 4-digit PIN.");
  }
  return value;
}

export const hasTransactionPin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ hasPin: boolean }> => {
    const { data, error } = await context.supabase.rpc("has_transaction_pin");
    if (error) throw new Error(error.message);
    return { hasPin: Boolean(data) };
  });

export const setTransactionPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pin: string }) => ({
    pin: assertFourDigitPin(input?.pin),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("set_transaction_pin", {
      _pin: data.pin,
    });
    if (error) {
      if (error.message.includes("pin_already_set")) {
        throw new Error("A transaction PIN is already set. Use change PIN instead.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const changeTransactionPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { currentPin: string; newPin: string }) => ({
    currentPin: assertFourDigitPin(input?.currentPin),
    newPin: assertFourDigitPin(input?.newPin),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("change_transaction_pin", {
      _current_pin: data.currentPin,
      _new_pin: data.newPin,
    });
    if (error) {
      if (error.message.includes("pin_locked")) {
        throw new Error("PIN temporarily locked after too many failed attempts. Try again later.");
      }
      if (error.message.includes("invalid_pin")) {
        throw new Error("Current PIN is incorrect.");
      }
      if (error.message.includes("pin_not_set")) {
        throw new Error("No transaction PIN is set yet.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const verifyTransactionPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pin: string }) => ({
    pin: assertFourDigitPin(input?.pin),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("verify_transaction_pin", {
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
      throw new Error(error.message);
    }
    return { ok: true };
  });
