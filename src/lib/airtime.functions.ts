<<<<<<< HEAD
PLACEHOLDER_USE_PATCH
=======
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type AirtimePurchaseResult = {
  status: "successful" | "pending" | "failed";
  reference: string;
  requestId: string;
  providerTransactionId: string | null;
  amount: number;
  phoneMasked: string;
  network: string;
  balanceAfter: number | null;
  message: string;
};

function maskPhone(phone: string): string {
  if (phone.length < 7) return "••••";
  return `${phone.slice(0, 3)}••••${phone.slice(-3)}`;
}

function safePayload(raw: unknown): Json {
  try {
    return JSON.parse(JSON.stringify(raw)) as Json;
  } catch {
    return {};
  }
}

function customerMessage(
  status: AirtimePurchaseResult["status"],
  amount?: number,
  providerHint?: string | null,
): string {
  if (status === "successful") {
    return amount != null
      ? `Your Airtime purchase of ₦${Math.round(amount).toLocaleString("en-NG")} was successful.`
      : "Your Airtime purchase was successful.";
  }
  if (status === "failed") {
    const hint = (providerHint ?? "").trim();
    const upper = hint.toUpperCase();
    if (upper.includes("WHITELIST") || upper.includes("NOT WHITELISTED")) {
      return (
        "This airtime product is not enabled on the VTpass account yet. " +
        "In VTpass Sandbox → Profile → Product Settings, enable MTN/Glo/Airtel/9mobile airtime, then try again. " +
        "Your wallet has been refunded."
      );
    }
    if (!hint) {
      return (
        "Your Airtime purchase failed. Your wallet has been refunded. " +
        "On VTpass sandbox, use phone 08011111111 for a successful test."
      );
    }
    return `Your Airtime purchase failed (${hint}). Your wallet has been refunded.`;
  }
  return "Your Airtime purchase is still being confirmed. Your money is protected.";
}

function mapStartError(message: string): Error {
  if (message.includes("insufficient_funds")) {
    return new Error("insufficient_funds");
  }
  if (message.includes("invalid_pin")) return new Error("invalid_pin");
  if (message.includes("pin_locked")) return new Error("pin_locked");
  if (message.includes("pin_not_set")) return new Error("pin_not_set");
  if (message.includes("invalid_phone")) {
    return new Error("Enter a valid Nigerian mobile number.");
  }
  if (message.includes("unsupported_network")) {
    return new Error("unsupported_network");
  }
  if (message.includes("invalid amount")) {
    return new Error("Enter an amount between ₦50 and ₦50,000.");
  }
  return new Error(message);
}

export const purchaseAirtime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    network: string;
    phone: string;
    amount: number;
    pin: string;
    requestId?: string;
  }) => {
    const amount = Math.round(Number(input?.amount));
    if (!Number.isFinite(amount) || amount < 50 || amount > 50_000) {
      throw new Error("Enter an amount between ₦50 and ₦50,000.");
    }
    const pin = String(input?.pin ?? "");
    if (!/^\d{4}$/.test(pin)) throw new Error("Enter your 4-digit PIN.");
    const network = String(input?.network ?? "").trim().toLowerCase();
    if (!network) throw new Error("Select a network.");
    const phone = String(input?.phone ?? "").trim();
    if (!phone) throw new Error("Enter a phone number.");
    const requestId = String(input?.requestId ?? "").trim();
    return { network, phone, amount, pin, requestId: requestId || `airtime-${crypto.randomUUID()}` };
  })
  .handler(async ({ data, context }): Promise<AirtimePurchaseResult> => {
    const {
      getVtpassConfig,
      toVtpassAirtimeServiceId,
      normalizeNgPhone,
      vtpassPayAirtime,
      mapVtpassOutcome,
    } = await import("./vtpass.server");
    const { resolvePricing } = await import("./pricing.server");
    getVtpassConfig();

    let phone: string;
    try {
      phone = normalizeNgPhone(data.phone);
    } catch {
      throw new Error("Enter a valid Nigerian mobile number.");
    }

    let serviceId: string;
    try {
      serviceId = toVtpassAirtimeServiceId(data.network);
    } catch {
      throw new Error("unsupported_network");
    }

    // OPay-style: customer types face value and pays exactly that.
    // RockPay profit comes from VTpass commission/discount, not a customer surcharge.
    const providerAmount = data.amount;
    const pricing = await resolvePricing({
      service: "airtime",
      provider: serviceId,
      productCode: null,
      baseAmount: providerAmount,
    });
    // Always debit face value for airtime (ignore customer-facing markup rules).
    const customerAmount = providerAmount;
    void pricing.rockpayFee;

    const { data: duplicate } = await context.supabase
      .from("bill_transactions")
      .select("internal_reference, status")
      .eq("provider_request_id", data.requestId)
      .eq("user_id", context.userId)
      .limit(1);
    if (duplicate?.[0]) {
      throw new Error("This payment request has already been submitted. Refresh its status.");
    }

    const { data: started, error: startError } = await context.supabase.rpc("start_airtime_purchase", {
      _provider: serviceId,
      _phone: phone,
      _amount: customerAmount,
      _pin: data.pin,
      _request_id: data.requestId,
    });
    if (startError) {
      console.error("[airtime] start", startError.message);
      throw mapStartError(startError.message);
    }
    const row = Array.isArray(started) ? started[0] : started;
    if (!row?.internal_reference || !row?.request_id) {
      throw new Error("Could not start airtime purchase.");
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existingRows } = await (supabaseAdmin as any)
        .from("bill_transactions")
        .select("metadata")
        .eq("internal_reference", row.internal_reference)
        .limit(1);
      const prev = (existingRows?.[0]?.metadata ?? {}) as Record<string, unknown>;
      const { error: metadataError } = await (supabaseAdmin as any)
        .from("bill_transactions")
        .update({
          metadata: {
            ...prev,
            provider_amount: providerAmount,
            pricing_rule_id: pricing.pricingRuleId,
            rockpay_fee: pricing.rockpayFee,
            pricing_fallback: pricing.usedFallback,
            service_slug: "airtime",
          },
        })
        .eq("internal_reference", row.internal_reference);
      if (metadataError) throw metadataError;
    } catch (e) {
      console.warn("[airtime] could not persist provider_amount metadata before pay", e);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).rpc("trusted_complete_airtime_purchase", {
        _user_id: context.userId,
        _internal_reference: row.internal_reference,
        _outcome: "failed",
        _provider_transaction_id: "",
        _payload: { metadata_error: true },
      });
      throw new Error("Could not prepare this payment safely. Your wallet was not charged.");
    }

    const pay = await vtpassPayAirtime({
      requestId: String(row.request_id),
      serviceId,
      amount: providerAmount,
      phone,
    });
    const outcome = mapVtpassOutcome(pay);
    console.info("[airtime] pay", row.internal_reference, {
      code: pay.code,
      status: pay.contentStatus,
      desc: pay.responseDescription,
      txId: pay.transactionId,
      providerAmount,
      customerAmount,
      pricingRuleId: pricing.pricingRuleId,
      outcome,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: finalized, error: finError } = await (supabaseAdmin as any).rpc(
      "trusted_complete_airtime_purchase",
      {
        _user_id: context.userId,
        _internal_reference: row.internal_reference,
        _outcome: outcome,
        _provider_transaction_id: pay.transactionId ?? "",
        _payload: {
          vtpass_code: pay.code,
          vtpass_status: pay.contentStatus,
          response_description: pay.responseDescription,
          vtpass_snapshot: safePayload(pay.raw),
          provider_amount: providerAmount,
          pricing_rule_id: pricing.pricingRuleId,
          rockpay_fee: pricing.rockpayFee,
          pricing_fallback: pricing.usedFallback,
        },
      },
    );
    if (finError) {
      console.error("[airtime] complete", finError.message);
      await (supabaseAdmin as any)
        .from("bill_transactions")
        .update({
          ...(pay.transactionId ? { provider_transaction_id: pay.transactionId } : {}),
          provider_response_code: pay.code,
          provider_status: pay.contentStatus,
          provider_response_message: pay.responseDescription,
          provider_channel: "vtpass",
        })
        .eq("internal_reference", row.internal_reference);
      return {
        status: outcome,
        reference: row.internal_reference as string,
        requestId: row.request_id as string,
        providerTransactionId: pay.transactionId,
        amount: customerAmount,
        phoneMasked: maskPhone(phone),
        network: serviceId,
        balanceAfter: row.balance_after != null ? Number(row.balance_after) : null,
        message: customerMessage(outcome, customerAmount, pay.responseDescription),
      };
    }

    const fin = Array.isArray(finalized) ? finalized[0] : finalized;
    const status = (fin?.status ?? outcome) as AirtimePurchaseResult["status"];

    if (status === "successful") {
      try {
          const { maybeRecordTransactionProfit } = await import("./transaction-profits.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await maybeRecordTransactionProfit(supabaseAdmin as any, {
          internalReference: String(fin?.internal_reference ?? row.internal_reference),
          customerAmount,
          providerAmount,
          rockpayFee: pricing.rockpayFee,
          pricingRuleId: pricing.pricingRuleId,
          service: "airtime",
          provider: serviceId,
          productCode: null,
          providerCost: pay.totalAmount,
          providerCommission: pay.commission,
        });
      } catch (e) {
        console.error("[airtime] profit record", e);
      }
    }

    return {
      status,
      reference: (fin?.internal_reference ?? row.internal_reference) as string,
      requestId: row.request_id as string,
      providerTransactionId: pay.transactionId,
      amount: customerAmount,
      phoneMasked: maskPhone(phone),
      network: serviceId,
      balanceAfter: fin?.balance_after != null ? Number(fin.balance_after) : null,
      message: customerMessage(status, customerAmount, pay.responseDescription),
    };
  });

export const requeryAirtime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    const reference = String(input?.reference ?? "").trim();
    if (!reference) throw new Error("Missing transaction reference.");
    return { reference };
  })
  .handler(async ({ data, context }): Promise<AirtimePurchaseResult> => {
    return requeryAirtimeCore({
      supabase: context.supabase,
      userId: context.userId,
      reference: data.reference,
    });
  });

export const adminRequeryAirtime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    const reference = String(input?.reference ?? "").trim();
    if (!reference) throw new Error("Missing transaction reference.");
    return { reference };
  })
  .handler(async ({ data, context }): Promise<AirtimePurchaseResult> => {
    const { data: staff, error: staffErr } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (staffErr || !staff) throw new Error("forbidden");

    return requeryAirtimeCore({
      supabase: context.supabase,
      userId: context.userId,
      reference: data.reference,
      audit: true,
    });
  });

export async function requeryAirtimeCore(opts: {
  supabase: any;
  userId?: string | null;
  reference: string;
  audit?: boolean;
}): Promise<AirtimePurchaseResult> {
  const { vtpassRequery, mapVtpassOutcome } = await import("./vtpass.server");
  const { supabase, reference } = opts;

  const { data: bills, error } = await supabase
    .from("bill_transactions")
    .select(
      "id, internal_reference, status, amount, provider, customer_identifier, provider_request_id, provider_transaction_id, user_id, metadata",
    )
    .eq("internal_reference", reference)
    .limit(1);

  if (error) throw new Error(error.message);
  const bill = bills?.[0];
  if (!bill) throw new Error("Transaction not found.");
  if (opts.userId && bill.user_id && bill.user_id !== opts.userId) {
    throw new Error("Transaction not found.");
  }

  const amount = Number(bill.amount);
  const phone = String(bill.customer_identifier ?? "");
  const network = String(bill.provider ?? "");
  const prevStatus = bill.status;

  if (bill.status === "successful" || bill.status === "failed") {
    if (opts.audit) {
      await supabase.rpc("admin_write_audit", {
        _action: "airtime_requery",
        _description: `Requery ${reference}: already ${bill.status}`,
        _target_type: "bill_transaction",
        _target_id: bill.id,
        _metadata: {
          reference,
          previous_status: prevStatus,
          mapped_outcome: bill.status,
        },
      });
    }
    return {
      status: bill.status as "successful" | "failed",
      reference: bill.internal_reference,
      requestId: bill.provider_request_id ?? "",
      providerTransactionId: bill.provider_transaction_id,
      amount,
      phoneMasked: maskPhone(phone),
      network,
      balanceAfter: null,
      message: customerMessage(bill.status as "successful" | "failed", amount),
    };
  }

  if (!bill.provider_request_id) {
    throw new Error(
      "We couldn't confirm this payment yet. Your money is still protected. Check again shortly or contact RockPay Care.",
    );
  }

  const pay = await vtpassRequery(bill.provider_request_id);
  const outcome = mapVtpassOutcome(pay);
  console.info("[airtime] requery", reference, pay.code, pay.contentStatus, outcome);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: finalized, error: finError } = await (supabaseAdmin as any).rpc("trusted_complete_airtime_purchase", {
    _user_id: opts.userId,
    _internal_reference: bill.internal_reference,
    _outcome: outcome,
    _provider_transaction_id: pay.transactionId ?? bill.provider_transaction_id ?? "",
    _payload: {
      vtpass_code: pay.code,
      vtpass_status: pay.contentStatus,
      response_description: pay.responseDescription,
      requery: true,
      vtpass_snapshot: safePayload(pay.raw),
    },
  });
  if (finError) throw new Error(finError.message);

  if (opts.audit) {
    await supabase.rpc("admin_write_audit", {
      _action: "airtime_requery",
      _description: `Requery ${reference}: ${prevStatus} → ${outcome}`,
      _target_type: "bill_transaction",
      _target_id: bill.id,
      _metadata: {
        reference,
        previous_status: prevStatus,
        mapped_outcome: outcome,
        vtpass_code: pay.code,
        vtpass_status: pay.contentStatus,
      },
    });
  }

  const fin = Array.isArray(finalized) ? finalized[0] : finalized;
  const status = (fin?.status ?? outcome) as AirtimePurchaseResult["status"];

  if (status === "successful") {
    try {
      const { maybeRecordTransactionProfit } = await import("./transaction-profits.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const meta = (bill.metadata ?? {}) as Record<string, unknown>;
      const providerAmountRaw = meta["provider_amount"];
      const providerAmount =
        typeof providerAmountRaw === "number" && Number.isFinite(providerAmountRaw)
          ? Number(providerAmountRaw)
          : typeof providerAmountRaw === "string" &&
              Number.isFinite(Number(providerAmountRaw))
            ? Number(providerAmountRaw)
            : null;
      if (providerAmount == null) {
        console.warn(
          "[airtime-requery] profit skipped: provider_amount missing from metadata; will not substitute customer amount",
          bill.internal_reference,
        );
      } else {
        const rockpayFee =
          typeof meta["rockpay_fee"] === "number"
            ? Number(meta["rockpay_fee"])
            : typeof meta["rockpay_fee"] === "string" &&
                Number.isFinite(Number(meta["rockpay_fee"]))
              ? Number(meta["rockpay_fee"])
              : null;
        const pricingRuleId =
          typeof meta["pricing_rule_id"] === "string" ? meta["pricing_rule_id"] : null;
        await maybeRecordTransactionProfit(supabaseAdmin as any, {
          internalReference: bill.internal_reference,
          customerAmount: amount,
          providerAmount,
          rockpayFee,
          pricingRuleId,
          service: "airtime",
          provider: String(bill.provider ?? network ?? ""),
          productCode: null,
          providerCost: pay.totalAmount,
          providerCommission: pay.commission,
        });
      }
    } catch (e) {
      console.error("[airtime-requery] profit record", e);
    }
  }

  return {
    status,
    reference: bill.internal_reference,
    requestId: bill.provider_request_id,
    providerTransactionId: pay.transactionId ?? bill.provider_transaction_id,
    amount,
    phoneMasked: maskPhone(phone),
    network,
    balanceAfter: fin?.balance_after != null ? Number(fin.balance_after) : null,
    message: customerMessage(status, amount, pay.responseDescription),
  };
}
>>>>>>> daadb04 (fix: OPay-style airtime face value; exam pins no phone, deliver to profile email)
