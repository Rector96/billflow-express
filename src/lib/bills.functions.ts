import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

/**
 * TEMP: re-export shim while full file is restored from known-good path.
 * Real implementation is inlined below for electricity/cable with vendor router.
 */
export type BillPurchaseResult = {
  status: "successful" | "pending" | "failed";
  reference: string;
  requestId: string;
  providerTransactionId: string | null;
  amount: number;
  identifierMasked: string;
  provider: string;
  product: string | null;
  token: string | null;
  balanceAfter: number | null;
  message: string;
  customerName: string | null;
};

function maskId(id: string): string {
  if (id.length < 5) return "••••";
  return `••••${id.slice(-4)}`;
}
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
  status: BillPurchaseResult["status"],
  slug: string,
  amount?: number,
  providerHint?: string | null,
): string {
  const label =
    slug === "cable"
      ? "Cable TV"
      : slug === "electricity"
        ? "Electricity"
        : slug === "data"
          ? "Data"
          : "Bill";
  if (status === "successful") {
    return amount
      ? `Your ${label} payment of ₦${Math.round(amount).toLocaleString("en-NG")} was successful.`
      : `Your ${label} payment was successful.`;
  }
  if (status === "failed") {
    return providerHint
      ? `Your ${label} payment failed (${providerHint}). Your wallet has been refunded.`
      : `Your ${label} payment failed. Your wallet has been refunded.`;
  }
  return `Your ${label} payment is still being confirmed.`;
}

async function settleBillPurchase(
  context: { supabase: any; userId: string },
  input: {
    slug: string;
    serviceID: string;
    product: string | null;
    identifier: string;
    amount: number;
    requestId: string;
    providerRequestId: string;
    customerName: string | null;
    metadata: Record<string, unknown>;
    providerPayload: Record<string, unknown>;
    providerTransactionId: string | null;
    providerResult: import("./vtpass.server").VtpassPayResult;
  },
): Promise<BillPurchaseResult> {
  const { mapVtpassOutcome } = await import("./vtpass.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const outcome = mapVtpassOutcome(input.providerResult);
  const { data: finalized, error } = await supabaseAdmin.rpc("trusted_complete_bill_purchase", {
    _user_id: context.userId,
    _internal_reference: input.requestId,
    _outcome: outcome,
    _provider_transaction_id: input.providerTransactionId ?? "",
    _payload: input.providerPayload,
  });
  if (error) throw new Error(error.message);
  const fin = Array.isArray(finalized) ? finalized[0] : finalized;
  const status = (fin?.status ?? outcome) as BillPurchaseResult["status"];
  return {
    status,
    reference: String(fin?.internal_reference ?? input.requestId),
    requestId: input.providerRequestId,
    providerTransactionId: input.providerTransactionId,
    amount: input.amount,
    identifierMasked: input.slug === "data" ? maskPhone(input.identifier) : maskId(input.identifier),
    provider: input.serviceID,
    product: input.product,
    token: input.providerResult.purchasedCode,
    balanceAfter: fin?.balance_after != null ? Number(fin.balance_after) : null,
    message: customerMessage(status, input.slug, input.amount, input.providerResult.responseDescription),
    customerName: input.customerName,
  };
}

async function recordBillProfit(opts: {
  reference: string;
  service: "data" | "cable" | "electricity";
  provider: string;
  productCode: string | null;
  customerAmount: number;
  providerAmount: number;
  rockpayFee: number | null;
  pricingRuleId: string | null;
  vtpassTotalAmount: number | null;
  vtpassCommission: number | null;
}) {
  const { maybeRecordTransactionProfit } = await import("./transaction-profits.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await maybeRecordTransactionProfit(supabaseAdmin as any, {
    internalReference: opts.reference,
    customerAmount: opts.customerAmount,
    providerAmount: opts.providerAmount,
    rockpayFee: opts.rockpayFee,
    pricingRuleId: opts.pricingRuleId,
    service: opts.service,
    provider: opts.provider,
    productCode: opts.productCode,
    providerCost: opts.vtpassTotalAmount,
    providerCommission: opts.vtpassCommission,
  });
}

async function rejectDuplicateRequest(context: { supabase: any; userId: string }, requestId: string) {
  const { data } = await context.supabase
    .from("bill_transactions")
    .select("internal_reference")
    .eq("provider_request_id", requestId)
    .eq("user_id", context.userId)
    .limit(1);
  if (data?.[0]) throw new Error("This payment request has already been submitted. Refresh its status.");
}

export const listVtpassServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { category: string }) => ({
    category: String(input?.category ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    const { getVtpassConfig, vtpassListServices } = await import("./vtpass.server");
    getVtpassConfig();
    return vtpassListServices(data.category);
  });

export const listVtpassVariations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceID: string }) => ({
    serviceID: String(input?.serviceID ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    const { getVtpassConfig, vtpassListVariations } = await import("./vtpass.server");
    getVtpassConfig();
    return vtpassListVariations(data.serviceID);
  });

export const verifyVtpassCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceID: string; billersCode: string; type?: string }) => ({
    serviceID: String(input?.serviceID ?? "").trim(),
    billersCode: String(input?.billersCode ?? "").replace(/\s/g, ""),
    type: input?.type ? String(input.type) : undefined,
  }))
  .handler(async ({ data }) => {
    const { getVtpassConfig, vtpassMerchantVerify } = await import("./vtpass.server");
    getVtpassConfig();
    return vtpassMerchantVerify({
      serviceID: data.serviceID,
      billersCode: data.billersCode,
      type: data.type,
    });
  });

export const purchaseCable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serviceID: string;
    billersCode: string;
    variationCode: string;
    amount: number;
    pin: string;
    phone?: string;
    customerName?: string;
    subscriptionType?: string;
    requestId?: string;
  }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    const billersCode = String(input?.billersCode ?? "").replace(/\s/g, "");
    const variationCode = String(input?.variationCode ?? "").trim();
    const amount = Math.round(Number(input?.amount));
    const pin = String(input?.pin ?? "");
    if (!serviceID || !billersCode || !variationCode || !Number.isFinite(amount) || amount < 50)
      throw new Error("Invalid cable payment details.");
    if (!/^\d{4}$/.test(pin)) throw new Error("Enter your 4-digit PIN.");
    return {
      serviceID,
      billersCode,
      variationCode,
      amount,
      pin,
      phone: input?.phone,
      customerName: input?.customerName,
      subscriptionType: input?.subscriptionType || "change",
      requestId: String(input?.requestId ?? "").trim() || `cable-${crypto.randomUUID()}`,
    };
  })
  .handler(async ({ data, context }): Promise<BillPurchaseResult> => {
    const { getVtpassConfig, vtpassListVariations, normalizeNgPhone } = await import("./vtpass.server");
    const { routeCablePay, toVtpassShape } = await import("./vendor-router.server");
    const { resolvePricing } = await import("./pricing.server");
    getVtpassConfig();
    const variations = await vtpassListVariations(data.serviceID);
    const pack = variations.find((variation) => variation.variationCode === data.variationCode);
    if (!pack) throw new Error("Selected package is no longer available.");
    const providerAmount = Math.round(pack.amount);
    const pricing = await resolvePricing({
      service: "cable",
      provider: data.serviceID,
      productCode: data.variationCode,
      baseAmount: providerAmount,
    });
    await rejectDuplicateRequest(context, data.requestId);
    let phone = "08011111111";
    if (data.phone) {
      try {
        phone = normalizeNgPhone(data.phone);
      } catch {
        /* sandbox */
      }
    }
    const { data: started, error } = await context.supabase.rpc("start_bill_purchase", {
      _service_slug: "cable",
      _service_label: "Cable TV",
      _provider: data.serviceID,
      _product: pack.name,
      _customer_identifier: data.billersCode,
      _amount: pricing.customerAmount,
      _pin: data.pin,
      _metadata: {
        title: "Cable TV",
        service_slug: "cable",
        variation_code: data.variationCode,
        provider_amount: providerAmount,
        pricing_rule_id: pricing.pricingRuleId,
        rockpay_fee: pricing.rockpayFee,
      },
      _request_id: data.requestId,
    });
    if (error) throw new Error(error.message.includes("insufficient_funds") ? "insufficient_funds" : error.message);
    const row = Array.isArray(started) ? started[0] : started;
    if (!row?.internal_reference || !row?.request_id) throw new Error("Could not start cable purchase.");
    const routed = await routeCablePay({
      request_id: row.request_id,
      serviceID: data.serviceID,
      billersCode: data.billersCode,
      variation_code: data.variationCode,
      amount: providerAmount,
      phone,
      subscription_type: data.subscriptionType,
    });
    const pay = toVtpassShape(routed);
    const result = await settleBillPurchase(context, {
      slug: "cable",
      serviceID: data.serviceID,
      product: pack.name,
      identifier: data.billersCode,
      amount: pricing.customerAmount,
      requestId: row.internal_reference,
      providerRequestId: row.request_id,
      customerName: data.customerName ?? null,
      metadata: {
        provider_amount: providerAmount,
        pricing_rule_id: pricing.pricingRuleId,
        rockpay_fee: pricing.rockpayFee,
      },
      providerPayload: {
        vtpass_code: pay.code,
        vtpass_status: pay.contentStatus,
        response_description: pay.responseDescription,
        purchased_code: pay.purchasedCode,
        vendor: routed.vendor,
        fallback_used: routed.fallbackUsed,
        vtpass_snapshot: safePayload(pay.raw),
      },
      providerTransactionId: pay.transactionId,
      providerResult: pay,
    });
    if (result.status === "successful") {
      await recordBillProfit({
        reference: result.reference,
        service: "cable",
        provider: data.serviceID,
        productCode: data.variationCode,
        customerAmount: pricing.customerAmount,
        providerAmount,
        rockpayFee: pricing.rockpayFee,
        pricingRuleId: pricing.pricingRuleId,
        vtpassTotalAmount: pay.totalAmount,
        vtpassCommission: pay.commission,
      });
    }
    return result;
  });

export const purchaseElectricity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serviceID: string;
    billersCode: string;
    meterType: string;
    amount: number;
    pin: string;
    phone?: string;
    customerName?: string;
    minAmount?: number;
    requestId?: string;
  }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    const billersCode = String(input?.billersCode ?? "").replace(/\s/g, "");
    const meterType = String(input?.meterType ?? "").trim().toLowerCase();
    const amount = Math.round(Number(input?.amount));
    const pin = String(input?.pin ?? "");
    if (!serviceID || !billersCode || (meterType !== "prepaid" && meterType !== "postpaid"))
      throw new Error("Invalid electricity payment details.");
    if (!Number.isFinite(amount) || amount < 50) throw new Error("Enter a valid amount.");
    if (!/^\d{4}$/.test(pin)) throw new Error("Enter your 4-digit PIN.");
    return {
      serviceID,
      billersCode,
      meterType,
      amount,
      pin,
      phone: input?.phone,
      customerName: input?.customerName,
      minAmount: input?.minAmount,
      requestId: String(input?.requestId ?? "").trim() || `power-${crypto.randomUUID()}`,
    };
  })
  .handler(async ({ data, context }): Promise<BillPurchaseResult> => {
    const { getVtpassConfig, vtpassMerchantVerify, normalizeNgPhone } = await import("./vtpass.server");
    const { routeElectricityPay, toVtpassShape } = await import("./vendor-router.server");
    const { resolvePricing } = await import("./pricing.server");
    getVtpassConfig();
    const verified = await vtpassMerchantVerify({
      serviceID: data.serviceID,
      billersCode: data.billersCode,
      type: data.meterType,
    });
    if (!verified.ok || !verified.customerName) {
      throw new Error(verified.message || "Could not verify meter.");
    }
    if (data.minAmount && data.amount < data.minAmount) {
      throw new Error("Amount is below the provider minimum.");
    }
    const pricing = await resolvePricing({
      service: "electricity",
      provider: data.serviceID,
      productCode: data.meterType,
      baseAmount: data.amount,
    });
    await rejectDuplicateRequest(context, data.requestId);
    let phone = "08011111111";
    if (data.phone) {
      try {
        phone = normalizeNgPhone(data.phone);
      } catch {
        /* sandbox */
      }
    }
    const { data: started, error } = await context.supabase.rpc("start_bill_purchase", {
      _service_slug: "electricity",
      _service_label: "Electricity",
      _provider: data.serviceID,
      _product: data.meterType,
      _customer_identifier: data.billersCode,
      _amount: pricing.customerAmount,
      _pin: data.pin,
      _metadata: {
        title: "Electricity",
        service_slug: "electricity",
        meter_type: data.meterType,
        provider_amount: data.amount,
        pricing_rule_id: pricing.pricingRuleId,
        rockpay_fee: pricing.rockpayFee,
      },
      _request_id: data.requestId,
    });
    if (error) throw new Error(error.message.includes("insufficient_funds") ? "insufficient_funds" : error.message);
    const row = Array.isArray(started) ? started[0] : started;
    if (!row?.internal_reference || !row?.request_id) throw new Error("Could not start electricity purchase.");
    const routed = await routeElectricityPay({
      request_id: row.request_id,
      serviceID: data.serviceID,
      billersCode: data.billersCode,
      meterType: data.meterType,
      amount: data.amount,
      phone,
    });
    const pay = toVtpassShape(routed);
    const result = await settleBillPurchase(context, {
      slug: "electricity",
      serviceID: data.serviceID,
      product: data.meterType,
      identifier: data.billersCode,
      amount: pricing.customerAmount,
      requestId: row.internal_reference,
      providerRequestId: row.request_id,
      customerName: verified.customerName,
      metadata: {
        provider_amount: data.amount,
        pricing_rule_id: pricing.pricingRuleId,
        rockpay_fee: pricing.rockpayFee,
      },
      providerPayload: {
        vtpass_code: pay.code,
        vtpass_status: pay.contentStatus,
        response_description: pay.responseDescription,
        purchased_code: pay.purchasedCode,
        token: pay.purchasedCode,
        vendor: routed.vendor,
        fallback_used: routed.fallbackUsed,
        vtpass_snapshot: safePayload(pay.raw),
      },
      providerTransactionId: pay.transactionId,
      providerResult: pay,
    });
    if (result.status === "successful") {
      await recordBillProfit({
        reference: result.reference,
        service: "electricity",
        provider: data.serviceID,
        productCode: data.meterType,
        customerAmount: pricing.customerAmount,
        providerAmount: data.amount,
        rockpayFee: pricing.rockpayFee,
        pricingRuleId: pricing.pricingRuleId,
        vtpassTotalAmount: pay.totalAmount,
        vtpassCommission: pay.commission,
      });
    }
    return result;
  });

export const purchaseData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serviceID: string;
    phone: string;
    variationCode: string;
    pin: string;
    requestId?: string;
  }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    const phone = String(input?.phone ?? "").trim();
    const variationCode = String(input?.variationCode ?? "").trim();
    const pin = String(input?.pin ?? "");
    if (!serviceID || !phone || !variationCode) throw new Error("Invalid data payment details.");
    if (!/^\d{4}$/.test(pin)) throw new Error("Enter your 4-digit PIN.");
    return {
      serviceID,
      phone,
      variationCode,
      pin,
      requestId: String(input?.requestId ?? "").trim() || `data-${crypto.randomUUID()}`,
    };
  })
  .handler(async ({ data, context }): Promise<BillPurchaseResult> => {
    const {
      getVtpassConfig,
      vtpassListVariations,
      vtpassPay,
      normalizeNgPhone,
      toVtpassDataServiceId,
      MOBILE_DATA_SERVICE_IDS,
    } = await import("./vtpass.server");
    const { resolvePricing } = await import("./pricing.server");
    getVtpassConfig();
    let serviceID = data.serviceID;
    try {
      if (MOBILE_DATA_SERVICE_IDS?.has?.(serviceID) || true) {
        serviceID = toVtpassDataServiceId?.(data.serviceID) ?? data.serviceID;
      }
    } catch {
      serviceID = data.serviceID;
    }
    const variations = await vtpassListVariations(serviceID);
    const pack = variations.find((v) => v.variationCode === data.variationCode);
    if (!pack) throw new Error("Selected data plan is no longer available.");
    const providerAmount = Math.round(pack.amount);
    const pricing = await resolvePricing({
      service: "data",
      provider: serviceID,
      productCode: data.variationCode,
      baseAmount: providerAmount,
    });
    await rejectDuplicateRequest(context, data.requestId);
    const phone = normalizeNgPhone(data.phone);
    const { data: started, error } = await context.supabase.rpc("start_bill_purchase", {
      _service_slug: "data",
      _service_label: "Data",
      _provider: serviceID,
      _product: pack.name,
      _customer_identifier: phone,
      _amount: pricing.customerAmount,
      _pin: data.pin,
      _metadata: {
        title: "Data",
        service_slug: "data",
        variation_code: data.variationCode,
        provider_amount: providerAmount,
      },
      _request_id: data.requestId,
    });
    if (error) throw new Error(error.message.includes("insufficient_funds") ? "insufficient_funds" : error.message);
    const row = Array.isArray(started) ? started[0] : started;
    if (!row?.internal_reference || !row?.request_id) throw new Error("Could not start data purchase.");
    const pay = await vtpassPay({
      request_id: row.request_id,
      serviceID,
      billersCode: phone,
      variation_code: data.variationCode,
      amount: providerAmount,
      phone,
    });
    const result = await settleBillPurchase(context, {
      slug: "data",
      serviceID,
      product: pack.name,
      identifier: phone,
      amount: pricing.customerAmount,
      requestId: row.internal_reference,
      providerRequestId: row.request_id,
      customerName: null,
      metadata: { provider_amount: providerAmount },
      providerPayload: {
        vtpass_code: pay.code,
        vtpass_status: pay.contentStatus,
        response_description: pay.responseDescription,
        purchased_code: pay.purchasedCode,
        vtpass_snapshot: safePayload(pay.raw),
      },
      providerTransactionId: pay.transactionId,
      providerResult: pay,
    });
    if (result.status === "successful") {
      await recordBillProfit({
        reference: result.reference,
        service: "data",
        provider: serviceID,
        productCode: data.variationCode,
        customerAmount: pricing.customerAmount,
        providerAmount,
        rockpayFee: pricing.rockpayFee,
        pricingRuleId: pricing.pricingRuleId,
        vtpassTotalAmount: pay.totalAmount,
        vtpassCommission: pay.commission,
      });
    }
    return result;
  });
