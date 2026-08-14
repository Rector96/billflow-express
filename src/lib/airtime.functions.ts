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

/**
 * Authorize (PIN + debit + pending) then call VTpass sandbox.
 * Outcome is decided only from the provider response.
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
    if (!Number.isFinite(amount) || amount < 50 || amount > 50000) {
      throw new Error("Enter an amount between ₦50 and ₦50,000.");
    }
    const pin = String(input?.pin ?? "");
    if (!/^\d{4}$/.test(pin)) throw new Error("Enter your 4-digit PIN.");
    const network = String(input?.network ?? "").trim();
    if (!network) throw new Error("Select a network.");
    const phone = String(input?.phone ?? "").trim();
    if (!phone) throw new Error("Enter a phone number.");
    return { network, phone, amount, pin };
  })
  .handler(async ({ data, context }): Promise<AirtimePurchaseResult> => {
    const {
      getVtpassConfig,
      normalizeNgPhone,
      toVtpassServiceId,
      vtpassPayAirtime,
      mapVtpassOutcome,
    } = await import("./vtpass.server");

    getVtpassConfig();

    const phone = normalizeNgPhone(data.phone);
    const serviceId = toVtpassServiceId(data.network);

    const { data: started, error: startError } = await context.supabase.rpc(
      "start_airtime_purchase",
      {
        _provider: serviceId,
        _phone: phone,
        _amount: data.amount,
        _pin: data.pin,
      },
    );
    if (startError) {
      console.error("[airtime] start", startError.message);
      throw new Error(startError.message);
    }
    const row = Array.isArray(started) ? started[0] : started;
    if (!row?.internal_reference || !row?.request_id) {
      throw new Error("Could not start airtime purchase.");
    }

    const pay = await vtpassPayAirtime({
      serviceId,
      phone,
      amount: data.amount,
      requestId: row.request_id as string,
    });

    const outcome = mapVtpassOutcome(pay);
    console.info(
      "[airtime] pay",
      row.internal_reference,
      pay.code,
      pay.contentStatus,
      outcome,
    );

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
        message: "Your payment is being confirmed.",
      };
    }

    const fin = Array.isArray(finalized) ? finalized[0] : finalized;
    const status = (fin?.status ?? outcome) as AirtimePurchaseResult["status"];

    const message =
      status === "successful"
        ? "Airtime purchase successful"
        : status === "failed"
          ? "Airtime purchase failed"
          : "Your payment is being confirmed.";

    return {
      status,
      reference: (fin?.internal_reference ?? row.internal_reference) as string,
      requestId: row.request_id as string,
      providerTransactionId: pay.transactionId,
      amount: data.amount,
      phoneMasked: maskPhone(phone),
      network: serviceId,
      balanceAfter: fin?.balance_after != null ? Number(fin.balance_after) : null,
      message,
    };
  });

/** Requery a pending airtime purchase by RockPay internal reference (customer). */
export const requeryAirtime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    const reference = String(input?.reference ?? "").trim();
    if (!reference) throw new Error("Missing transaction reference.");
    return { reference };
  })
  .handler(async ({ data, context }): Promise<AirtimePurchaseResult> => {
    return runRequery(context.supabase, data.reference, { audit: false });
  });

/** Staff requery — same settlement rules; writes admin_audit_logs. */
export const adminRequeryAirtime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    const reference = String(input?.reference ?? "").trim();
    if (!reference) throw new Error("Missing transaction reference.");
    return { reference };
  })
  .handler(async ({ data, context }): Promise<AirtimePurchaseResult> => {
    const { data: staff, error: staffErr } = await context.supabase.rpc("is_staff", {
      _user_id: (await context.supabase.auth.getUser()).data.user?.id,
    });
    if (staffErr || !staff) throw new Error("forbidden");

    const result = await runRequery(context.supabase, data.reference, { audit: true });
    return result;
  });

type Sb = {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function runRequery(
  supabase: Sb,
  reference: string,
  opts: { audit: boolean },
): Promise<AirtimePurchaseResult> {
  const { vtpassRequery, mapVtpassOutcome } = await import("./vtpass.server");

  const { data: bills, error } = await supabase
    .from("bill_transactions")
    .select(
      "id, internal_reference, status, amount, provider, customer_identifier, provider_request_id, provider_transaction_id",
    )
    .eq("internal_reference", reference)
    .limit(1);

  if (error) throw new Error(error.message);
  const bill = bills?.[0];
  if (!bill) throw new Error("Transaction not found.");

  const phone = String(bill.customer_identifier ?? "");
  const network = String(bill.provider ?? "");
  const amount = Number(bill.amount);
  const prevStatus = bill.status;

  if (bill.status === "successful" || bill.status === "failed") {
    // Still allow provider snapshot refresh via requery when request id exists (no money change — RPC is idempotent)
    if (bill.provider_request_id) {
      const pay = await vtpassRequery(bill.provider_request_id);
      const outcome = mapVtpassOutcome(pay);
      await supabase.rpc("complete_airtime_purchase", {
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
      if (opts.audit) {
        await supabase.rpc("admin_write_audit", {
          _action: "airtime_requery",
          _description: `Requery ${reference} (already ${bill.status})`,
          _target_type: "bill_transaction",
          _target_id: bill.id,
          _metadata: {
            reference,
            previous_status: prevStatus,
            mapped_outcome: outcome,
            vtpass_code: pay.code,
          },
        });
      }
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
      message:
        bill.status === "successful"
          ? "Airtime purchase successful"
          : "Airtime purchase failed",
    };
  }

  if (!bill.provider_request_id) {
    throw new Error("Missing provider reference for requery.");
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
    message:
      status === "successful"
        ? "Airtime purchase successful"
        : status === "failed"
          ? "Airtime purchase failed"
          : "Your payment is being confirmed.",
  };
}
