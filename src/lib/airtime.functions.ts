import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

function safePayload(raw: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
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

/**
 * Authorize (PIN + debit + pending) then call VTpass sandbox.
 * Outcome is decided only from the provider response — never from the client.
 */
export const purchaseAirtime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    network: string;
    phone: string;
    amount: number;
    pin: string;
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
    return { network, phone, amount, pin };
  })
  .handler(async ({ data, context }): Promise<AirtimePurchaseResult> => {
    const {
      getVtpassConfig,
      toVtpassAirtimeServiceId,
      normalizeNgPhone,
      vtpassPayAirtime,
      mapVtpassOutcome,
    } = await import("./vtpass.server");
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

    const { data: started, error: startError } = await context.supabase.rpc("start_airtime_purchase", {
      _provider: serviceId,
      _phone: phone,
      _amount: data.amount,
      _pin: data.pin,
    });
    if (startError) {
      console.error("[airtime] start", startError.message);
      throw mapStartError(startError.message);
    }
    const row = Array.isArray(started) ? started[0] : started;
    if (!row?.internal_reference || !row?.request_id) {
      throw new Error("Could not start airtime purchase.");
    }

    // Airtime VTU: request_id, serviceID, amount, phone only (VTpass docs)
    const pay = await vtpassPayAirtime({
      requestId: String(row.request_id),
      serviceId,
      amount: data.amount,
      phone,
    });
    const outcome = mapVtpassOutcome(pay);
    console.info("[airtime] pay", row.internal_reference, {
      code: pay.code,
      status: pay.contentStatus,
      desc: pay.responseDescription,
      txId: pay.transactionId,
      outcome,
    });

    const { data: finalized, error: finError } = await context.supabase.rpc(
      "complete_airtime_purchase",
      {
        _internal_reference: row.internal_reference,
        _outcome: outcome,
        _provider_transaction_id: pay.transactionId ?? "",
        _payload: {
          vtpass_code: pay.code,
          vtpass_status: pay.contentStatus,
          response_description: pay.responseDescription,
          vtpass_snapshot: safePayload(pay.raw),
        },
      },
    );
    if (finError) {
      console.error("[airtime] complete", finError.message);
      return {
        status: "pending",
        reference: row.internal_reference as string,
        requestId: row.request_id as string,
        providerTransactionId: pay.transactionId,
        amount: data.amount,
        phoneMasked: maskPhone(phone),
        network: serviceId,
        balanceAfter: row.balance_after != null ? Number(row.balance_after) : null,
        message: customerMessage("pending", data.amount),
      };
    }

    const fin = Array.isArray(finalized) ? finalized[0] : finalized;
    const status = (fin?.status ?? outcome) as AirtimePurchaseResult["status"];

    return {
      status,
      reference: (fin?.internal_reference ?? row.internal_reference) as string,
      requestId: row.request_id as string,
      providerTransactionId: pay.transactionId,
      amount: data.amount,
      phoneMasked: maskPhone(phone),
      network: serviceId,
      balanceAfter: fin?.balance_after != null ? Number(fin.balance_after) : null,
      message: customerMessage(status, data.amount, pay.responseDescription),
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

/** Staff requery — audited; no customer ownership restriction. */
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
      reference: data.reference,
      audit: true,
    });
  });

/** Shared requery used by customer + admin paths. */
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
      "id, internal_reference, status, amount, provider, customer_identifier, provider_request_id, provider_transaction_id, user_id",
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

  const { data: finalized, error: finError } = await supabase.rpc("complete_airtime_purchase", {
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
