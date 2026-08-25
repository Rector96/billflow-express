import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

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
    return amount != null
      ? `Your ${label} purchase of ₦${Math.round(amount).toLocaleString("en-NG")} was successful.`
      : `Your ${label} purchase was successful.`;
  }

  if (status === "failed") {
    const hint = (providerHint ?? "").trim();
    const upper = hint.toUpperCase();
    if (upper.includes("WHITELIST") || upper.includes("NOT WHITELISTED")) {
      return (
        `This ${label.toLowerCase()} product is not enabled on VTpass yet. ` +
        "Enable it under Sandbox → Product Settings, then try again. Wallet refunded."
      );
    }
    if (hint) {
      return `Your ${label} purchase failed (${hint}). Your wallet has been refunded.`;
    }
    return `Your ${label} purchase failed. Your wallet has been refunded.`;
  }

  return `Your ${label} purchase is still being confirmed. Your money is protected.`;
}

function mapStartError(message: string): Error {
  if (message.includes("insufficient_funds")) return new Error("insufficient_funds");
  if (message.includes("invalid_pin")) return new Error("invalid_pin");
  if (message.includes("pin_locked")) return new Error("pin_locked");
  if (message.includes("pin_not_set")) return new Error("pin_not_set");
  if (message.includes("invalid amount")) return new Error("Enter a valid amount.");
  if (message.includes("unsupported_service")) return new Error("This service is not available yet.");
  if (
    message.includes("invalid_phone") ||
    message.includes("Enter a valid Nigerian")
  ) {
    return new Error("Enter a valid Nigerian mobile number.");
  }

  return new Error(message);
}

export const listVtpassServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { category: string }) => {
    const category = String(input?.category ?? "").trim();
    if (
      category !== "tv-subscription" &&
      category !== "electricity-bill" &&
      category !== "data"
    ) {
      throw new Error("Unsupported catalogue category.");
    }
    return { category };
  })
  .handler(async ({ data }) => {
    const { getVtpassConfig, vtpassListServices } = await import("./vtpass.server");
    getVtpassConfig();
    const services = await vtpassListServices(data.category);
    return services.map((s) => ({
      serviceID: s.serviceID,
      name: s.name,
      minimumAmount: s.minimumAmount,
      maximumAmount: s.maximumAmount,
    }));
  });

export const listVtpassVariations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceID: string }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    if (!serviceID) throw new Error("Select a provider.");
    return { serviceID };
  })
  .handler(async ({ data }) => {
    const { getVtpassConfig, vtpassListVariations } = await import("./vtpass.server");
    getVtpassConfig();
    const variations = await vtpassListVariations(data.serviceID);
    return variations.map((v) => ({
      variationCode: v.variationCode,
      name: v.name,
      amount: v.amount,
      fixedPrice: v.fixedPrice,
    }));
  });

export const verifyVtpassCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serviceID: string;
    billersCode: string;
    type?: string;
  }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    const billersCode = String(input?.billersCode ?? "").replace(/\s/g, "");
    if (!serviceID) throw new Error("Select a provider.");
    if (!billersCode || billersCode.length < 5) {
      throw new Error("Enter a valid number.");
    }
    const type = input?.type ? String(input.type).trim().toLowerCase() : undefined;
    if (type && type !== "prepaid" && type !== "postpaid") {
      throw new Error("Select prepaid or postpaid.");
    }
    return { serviceID, billersCode, type };
  })
  .handler(async ({ data }) => {
    const { getVtpassConfig, vtpassMerchantVerify } = await import("./vtpass.server");
    getVtpassConfig();
    const result = await vtpassMerchantVerify({
      serviceID: data.serviceID,
      billersCode: data.billersCode,
      type: data.type,
    });
    if (!result.ok) {
      if (data.type === "prepaid" || data.type === "postpaid") {
        throw new Error(
          result.message ||
            "Meter verification failed. Please check the meter number and try again.",
        );
      }
      throw new Error(
        result.message || "Could not verify this number. Check and try again.",
      );
    }
    return {
      customerName: result.customerName,
      address: result.address,
      status: result.status,
      dueDate: result.dueDate,
      customerNumber: result.customerNumber,
      minPurchaseAmount: result.minPurchaseAmount,
      tariff: result.tariff,
      meterNumber: result.meterNumber,
      snapshot: safePayload(result.raw),
    };
  });

async function settleBillPurchase(
  context: { supabase: any; userId: string },
  input: {
    slug: "data" | "cable" | "electricity";
    serviceID: string;
    product: string;
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
  const outcome = mapVtpassOutcome(input.providerResult);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: finalized, error } = await (supabaseAdmin as any).rpc(
    "trusted_complete_bill_purchase",
    {
      _user_id: context.userId,
      _internal_reference: input.requestId,
      _outcome: outcome,
      _provider_transaction_id: input.providerTransactionId ?? "",
      _payload: {
        ...input.providerPayload,
        ...input.metadata,
      },
    },
  );
  if (error) {
    console.error(`[${input.slug}] complete`, error.message);
    return {
      status: "pending",
      reference: input.requestId,
      requestId: input.providerRequestId,
      providerTransactionId: input.providerTransactionId,
      amount: input.amount,
      identifierMasked: input.slug === "data" ? maskPhone(input.identifier) : maskId(input.identifier),
      provider: input.serviceID,
      product: input.product,
      token: null,
      balanceAfter: null,
      message: customerMessage("pending", input.slug),
      customerName: input.customerName,
    };
  }
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

async function recordBillProfit(
  reference: string,
  service: "data" | "cable" | "electricity",
  provider: string,
  productCode: string,
  customerAmount: number,
  providerAmount: number,
) {
  const { maybeRecordTransactionProfit } = await import("./transaction-profits.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await maybeRecordTransactionProfit(supabaseAdmin as any, {
    internalReference: reference,
    customerAmount,
    providerAmount,
    rockpayFee: null,
    pricingRuleId: null,
    service: service,
    provider,
    productCode,
    providerCost: null,
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

export const purchaseCable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceID: string; billersCode: string; variationCode: string; amount: number; pin: string; phone?: string; customerName?: string; subscriptionType?: string; requestId?: string }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    const billersCode = String(input?.billersCode ?? "").replace(/\s/g, "");
    const variationCode = String(input?.variationCode ?? "").trim();
    const amount = Math.round(Number(input?.amount));
    const pin = String(input?.pin ?? "");
    if (!serviceID || !billersCode || !variationCode || !Number.isFinite(amount) || amount < 50) throw new Error("Invalid cable payment details.");
    if (!/^\d{4}$/.test(pin)) throw new Error("Enter your 4-digit PIN.");
    return { serviceID, billersCode, variationCode, amount, pin, phone: input?.phone, customerName: input?.customerName, subscriptionType: input?.subscriptionType || "change", requestId: String(input?.requestId ?? "").trim() || `cable-${crypto.randomUUID()}` };
  })
  .handler(async ({ data, context }): Promise<BillPurchaseResult> => {
    const { getVtpassConfig, vtpassListVariations, vtpassPay, normalizeNgPhone } = await import("./vtpass.server");
    const { resolvePricing } = await import("./pricing.server");
    getVtpassConfig();
    const variations = await vtpassListVariations(data.serviceID);
    const pack = variations.find((variation) => variation.variationCode === data.variationCode);
    if (!pack) throw new Error("Selected package is no longer available.");
    const providerAmount = Math.round(pack.amount);
    const pricing = await resolvePricing({ service: "cable", provider: data.serviceID, productCode: data.variationCode, baseAmount: providerAmount });
    await rejectDuplicateRequest(context, data.requestId);
    let phone = "08011111111";
    if (data.phone) { try { phone = normalizeNgPhone(data.phone); } catch { /* sandbox fallback */ } }
    const { data: started, error } = await context.supabase.rpc("start_bill_purchase", {
      _service_slug: "cable", _service_label: "Cable TV", _provider: data.serviceID, _product: pack.name,
      _customer_identifier: data.billersCode, _amount: pricing.customerAmount, _pin: data.pin,
      _metadata: { title: "Cable TV Payment", service_slug: "cable", variation_code: data.variationCode, provider_amount: providerAmount, pricing_rule_id: pricing.pricingRuleId, rockpay_fee: pricing.rockpayFee, pricing_fallback: pricing.usedFallback, customer: data.customerName ?? null }, _request_id: data.requestId,
    });
    if (error) throw mapStartError(error.message);
    const row = Array.isArray(started) ? started[0] : started;
    if (!row?.internal_reference || !row?.request_id) throw new Error("Could not start cable payment.");
    const pay = await vtpassPay({ request_id: row.request_id, serviceID: data.serviceID, billersCode: data.billersCode, variation_code: data.variationCode, amount: providerAmount, phone, subscription_type: data.subscriptionType });
    const result = await settleBillPurchase(context, { slug: "cable", serviceID: data.serviceID, product: pack.name, identifier: data.billersCode, amount: pricing.customerAmount, requestId: row.internal_reference, providerRequestId: row.request_id, customerName: data.customerName ?? null, metadata: { provider_amount: providerAmount, pricing_rule_id: pricing.pricingRuleId, rockpay_fee: pricing.rockpayFee, pricing_fallback: pricing.usedFallback }, providerPayload: { vtpass_code: pay.code, vtpass_status: pay.contentStatus, response_description: pay.responseDescription, purchased_code: pay.purchasedCode, vtpass_snapshot: safePayload(pay.raw) }, providerTransactionId: pay.transactionId, providerResult: pay });
    if (result.status === "successful") await recordBillProfit(result.reference, "cable", data.serviceID, data.variationCode, pricing.customerAmount, providerAmount);
    return result;
  });

export const purchaseElectricity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceID: string; billersCode: string; meterType: string; amount: number; pin: string; phone?: string; customerName?: string; minAmount?: number; requestId?: string }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    const billersCode = String(input?.billersCode ?? "").replace(/\s/g, "");
    const meterType = String(input?.meterType ?? "").trim().toLowerCase();
    const amount = Math.round(Number(input?.amount));
    const pin = String(input?.pin ?? "");
    if (!serviceID || !billersCode || !Number.isFinite(amount) || amount < 50 || !["prepaid", "postpaid"].includes(meterType)) throw new Error("Invalid electricity payment details.");
    if (input?.minAmount && amount < Number(input.minAmount)) throw new Error("Amount is below the provider minimum.");
    if (!/^\d{4}$/.test(pin)) throw new Error("Enter your 4-digit PIN.");
    return { serviceID, billersCode, meterType, amount, pin, phone: input?.phone, customerName: input?.customerName, requestId: String(input?.requestId ?? "").trim() || `electricity-${crypto.randomUUID()}` };
  })
  .handler(async ({ data, context }): Promise<BillPurchaseResult> => {
    const { getVtpassConfig, vtpassMerchantVerify, vtpassPay, normalizeNgPhone } = await import("./vtpass.server");
    const { resolvePricing } = await import("./pricing.server");
    getVtpassConfig();
    const verified = await vtpassMerchantVerify({ serviceID: data.serviceID, billersCode: data.billersCode, type: data.meterType });
    if (!verified.ok || !verified.customerName) throw new Error(verified.message || "Meter verification failed.");
    if (verified.minPurchaseAmount && data.amount < verified.minPurchaseAmount) throw new Error("Amount is below the provider minimum.");
    const pricing = await resolvePricing({ service: "electricity", provider: data.serviceID, productCode: data.meterType, baseAmount: data.amount });
    await rejectDuplicateRequest(context, data.requestId);
    let phone = "08011111111";
    if (data.phone) { try { phone = normalizeNgPhone(data.phone); } catch { /* sandbox fallback */ } }
    const { data: started, error } = await context.supabase.rpc("start_bill_purchase", { _service_slug: "electricity", _service_label: "Electricity", _provider: data.serviceID, _product: data.meterType, _customer_identifier: data.billersCode, _amount: pricing.customerAmount, _pin: data.pin, _metadata: { title: "Electricity Payment", service_slug: "electricity", meter_type: data.meterType, provider_amount: data.amount, pricing_rule_id: pricing.pricingRuleId, rockpay_fee: pricing.rockpayFee, pricing_fallback: pricing.usedFallback, customer: verified.customerName }, _request_id: data.requestId });
    if (error) throw mapStartError(error.message);
    const row = Array.isArray(started) ? started[0] : started;
    if (!row?.internal_reference || !row?.request_id) throw new Error("Could not start electricity payment.");
    const pay = await vtpassPay({ request_id: row.request_id, serviceID: data.serviceID, billersCode: data.billersCode, variation_code: data.meterType, type: data.meterType, amount: data.amount, phone });
    const result = await settleBillPurchase(context, { slug: "electricity", serviceID: data.serviceID, product: data.meterType, identifier: data.billersCode, amount: pricing.customerAmount, requestId: row.internal_reference, providerRequestId: row.request_id, customerName: verified.customerName, metadata: { provider_amount: data.amount, pricing_rule_id: pricing.pricingRuleId, rockpay_fee: pricing.rockpayFee, pricing_fallback: pricing.usedFallback }, providerPayload: { vtpass_code: pay.code, vtpass_status: pay.contentStatus, response_description: pay.responseDescription, purchased_code: pay.purchasedCode, token: pay.purchasedCode, vtpass_snapshot: safePayload(pay.raw) }, providerTransactionId: pay.transactionId, providerResult: pay });
    if (result.status === "successful") await recordBillProfit(result.reference, "electricity", data.serviceID, data.meterType, pricing.customerAmount, data.amount);
    return result;
  });

export const purchaseData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceID: string; phone: string; variationCode: string; pin: string; requestId?: string }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    const phone = String(input?.phone ?? "").trim();
    const variationCode = String(input?.variationCode ?? "").trim();
    const pin = String(input?.pin ?? "");
    if (!serviceID || !phone || !variationCode) throw new Error("Invalid data payment details.");
    if (!/^\d{4}$/.test(pin)) throw new Error("Enter your 4-digit PIN.");
    return { serviceID, phone, variationCode, pin, requestId: String(input?.requestId ?? "").trim() || `data-${crypto.randomUUID()}` };
  })
  .handler(async ({ data, context }): Promise<BillPurchaseResult> => {
    const { getVtpassConfig, vtpassListVariations, vtpassPay, normalizeNgPhone, toVtpassDataServiceId, MOBILE_DATA_SERVICE_IDS } = await import("./vtpass.server");
    const { resolvePricing } = await import("./pricing.server");
    getVtpassConfig();
    const serviceID = MOBILE_DATA_SERVICE_IDS.has(data.serviceID) ? data.serviceID : toVtpassDataServiceId(data.serviceID);
    const phone = normalizeNgPhone(data.phone);
    const variations = await vtpassListVariations(serviceID);
    const pack = variations.find((variation) => variation.variationCode === data.variationCode);
    if (!pack) throw new Error("Selected plan is no longer available.");
    const providerAmount = Math.round(pack.amount);
    const pricing = await resolvePricing({ service: "data", provider: serviceID, productCode: data.variationCode, baseAmount: providerAmount });
    await rejectDuplicateRequest(context, data.requestId);
    const { data: started, error } = await context.supabase.rpc("start_bill_purchase", { _service_slug: "data", _service_label: "Data", _provider: serviceID, _product: pack.name, _customer_identifier: phone, _amount: pricing.customerAmount, _pin: data.pin, _metadata: { title: "Data Purchase", service_slug: "data", variation_code: data.variationCode, provider_amount: providerAmount, pricing_rule_id: pricing.pricingRuleId, rockpay_fee: pricing.rockpayFee, pricing_fallback: pricing.usedFallback }, _request_id: data.requestId });
    if (error) throw mapStartError(error.message);
    const row = Array.isArray(started) ? started[0] : started;
    if (!row?.internal_reference || !row?.request_id) throw new Error("Could not start data purchase.");
    const pay = await vtpassPay({ request_id: row.request_id, serviceID, billersCode: phone, variation_code: data.variationCode, amount: providerAmount, phone });
    const result = await settleBillPurchase(context, { slug: "data", serviceID, product: pack.name, identifier: phone, amount: pricing.customerAmount, requestId: row.internal_reference, providerRequestId: row.request_id, customerName: null, metadata: { provider_amount: providerAmount, pricing_rule_id: pricing.pricingRuleId, rockpay_fee: pricing.rockpayFee, pricing_fallback: pricing.usedFallback }, providerPayload: { vtpass_code: pay.code, vtpass_status: pay.contentStatus, response_description: pay.responseDescription, purchased_code: pay.purchasedCode, vtpass_snapshot: safePayload(pay.raw) }, providerTransactionId: pay.transactionId, providerResult: pay });
    if (result.status === "successful") await recordBillProfit(result.reference, "data", serviceID, data.variationCode, pricing.customerAmount, providerAmount);
    return result;
  });

export const requeryBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    const reference = String(input?.reference ?? "").trim();
    if (!reference) throw new Error("Missing transaction reference.");
    return { reference };
  })
  .handler(async ({ data, context }): Promise<BillPurchaseResult> => {
    const { vtpassRequery, mapVtpassOutcome } = await import("./vtpass.server");
    const { data: bills, error } = await context.supabase.from("bill_transactions").select("id, internal_reference, status, amount, provider, product, customer_identifier, provider_request_id, provider_transaction_id, user_id, metadata").eq("internal_reference", data.reference).limit(1);
    if (error) throw new Error(error.message);
    const bill = bills?.[0];
    if (!bill || bill.user_id !== context.userId) throw new Error("Transaction not found.");
    const meta = (bill.metadata ?? {}) as Record<string, unknown>;
    const slug = String(meta["service_slug"] ?? "bill") as "data" | "cable" | "electricity";
    const identifier = String(bill.customer_identifier ?? "");
    if (bill.status === "successful" || bill.status === "failed") return { status: bill.status, reference: bill.internal_reference, requestId: bill.provider_request_id ?? "", providerTransactionId: bill.provider_transaction_id, amount: Number(bill.amount), identifierMasked: slug === "data" ? maskPhone(identifier) : maskId(identifier), provider: String(bill.provider ?? ""), product: bill.product, token: typeof meta["token"] === "string" ? meta["token"] : null, balanceAfter: null, message: customerMessage(bill.status, slug, Number(bill.amount)), customerName: typeof meta["customer"] === "string" ? meta["customer"] : null };
    if (!bill.provider_request_id) throw new Error("Your money is protected. Check again shortly.");
    const pay = await vtpassRequery(bill.provider_request_id);
    const outcome = mapVtpassOutcome(pay);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: finalized, error: settleError } = await (supabaseAdmin as any).rpc("trusted_complete_bill_purchase", { _user_id: context.userId, _internal_reference: bill.internal_reference, _outcome: outcome, _provider_transaction_id: pay.transactionId ?? bill.provider_transaction_id ?? "", _payload: { vtpass_code: pay.code, vtpass_status: pay.contentStatus, response_description: pay.responseDescription, purchased_code: pay.purchasedCode, token: pay.purchasedCode, requery: true, vtpass_snapshot: safePayload(pay.raw) } });
    if (settleError) throw new Error(settleError.message);
    const fin = Array.isArray(finalized) ? finalized[0] : finalized;
    const status = (fin?.status ?? outcome) as BillPurchaseResult["status"];
    if (status === "successful" && ["data", "cable", "electricity"].includes(slug)) {
      const providerAmount = Number(meta["provider_amount"]);
      if (Number.isFinite(providerAmount)) {
        await recordBillProfit(
          bill.internal_reference,
          slug,
          String(bill.provider ?? ""),
          String(meta["variation_code"] ?? meta["meter_type"] ?? ""),
          Number(bill.amount),
          providerAmount,
        );
      }
    }
    return { status, reference: bill.internal_reference, requestId: bill.provider_request_id, providerTransactionId: pay.transactionId ?? bill.provider_transaction_id, amount: Number(bill.amount), identifierMasked: slug === "data" ? maskPhone(identifier) : maskId(identifier), provider: String(bill.provider ?? ""), product: bill.product, token: pay.purchasedCode ?? null, balanceAfter: fin?.balance_after != null ? Number(fin.balance_after) : null, message: customerMessage(status, slug, Number(bill.amount), pay.responseDescription), customerName: typeof meta["customer"] === "string" ? meta["customer"] : null };
  });
