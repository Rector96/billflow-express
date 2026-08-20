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
  }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    const billersCode = String(input?.billersCode ?? "").replace(/\s/g, "");
    const variationCode = String(input?.variationCode ?? "").trim();
    const amount = Math.round(Number(input?.amount));
    const pin = String(input?.pin ?? "");
    if (!serviceID) throw new Error("Select a provider.");
    if (!billersCode) throw new Error("Enter your smartcard number.");
    if (!variationCode) throw new Error("Select a package.");
    if (!Number.isFinite(amount) || amount < 50) {
      throw new Error("Enter a valid amount.");
    }
    if (!/^\d{4}$/.test(pin)) throw new Error("Enter your 4-digit PIN.");
    return {
      serviceID,
      billersCode,
      variationCode,
      amount,
      pin,
      phone: input?.phone ? String(input.phone) : undefined,
      customerName: input?.customerName ? String(input.customerName) : undefined,
      subscriptionType: input?.subscriptionType ? String(input.subscriptionType) : "change",
    };
  })
  .handler(async ({ data, context }): Promise<BillPurchaseResult> => {
    const {
      getVtpassConfig,
      vtpassListVariations,
      vtpassPay,
      mapVtpassOutcome,
      normalizeNgPhone,
    } = await import("./vtpass.server");
    const { resolvePricing } = await import("./pricing.server");
    getVtpassConfig();
    const variations = await vtpassListVariations(data.serviceID);
    const pack = variations.find((v) => v.variationCode === data.variationCode);
    if (!pack) {
      throw new Error("Selected package is no longer available. Refresh and try again.");
    }

    // Provider purchase amount: fixed packages use catalogue; variable use client-requested base.
    // Client amount is never the final RockPay customer price — pricing runs server-side.
    const providerAmount = pack.fixedPrice ? Math.round(pack.amount) : data.amount;
    if (providerAmount < 50) throw new Error("Enter a valid amount.");

    const pricing = await resolvePricing({
      service: "cable",
      provider: data.serviceID,
      productCode: data.variationCode,
      baseAmount: providerAmount,
    });
    const customerAmount = pricing.customerAmount;

    let phone = data.phone;
    try {
      if (phone) phone = normalizeNgPhone(phone);
    } catch {
      phone = undefined;
    }
    if (!phone) phone = "08011111111";

    const { data: started, error: startError } = await context.supabase.rpc("start_bill_purchase", {
      _service_slug: "cable",
      _service_label: "Cable TV",
      _provider: data.serviceID,
      _product: pack.name,
      _customer_identifier: data.billersCode,
      _amount: customerAmount,
      _pin: data.pin,
      _metadata: {
        title: "Cable TV Payment",
        service_slug: "cable",
        service_label: `${data.serviceID.toUpperCase()} ${pack.name}`,
        masked: maskId(data.billersCode),
        customer: data.customerName ?? null,
        variation_code: data.variationCode,
        subscription_type: data.subscriptionType,
        provider_amount: providerAmount,
        pricing_rule_id: pricing.pricingRuleId,
        rockpay_fee: pricing.rockpayFee,
        pricing_fallback: pricing.usedFallback,
      },
    });
    if (startError) {
      console.error("[cable] start", startError.message);
      throw mapStartError(startError.message);
    }
    const row = Array.isArray(started) ? started[0] : started;
    if (!row?.internal_reference || !row?.request_id) {
      throw new Error("Could not start cable payment.");
    }

    // VTpass receives provider/package amount only (no RockPay markup).
    const pay = await vtpassPay({
      request_id: row.request_id,
      serviceID: data.serviceID,
      billersCode: data.billersCode,
      variation_code: data.variationCode,
      amount: providerAmount,
      phone,
      subscription_type: data.subscriptionType || "change",
    });
    const outcome = mapVtpassOutcome(pay);
    console.info("[cable] pay", row.internal_reference, {
      code: pay.code,
      status: pay.contentStatus,
      providerAmount,
      customerAmount,
      pricingRuleId: pricing.pricingRuleId,
      outcome,
    });

    const { data: finalized, error: finError } = await context.supabase.rpc("complete_bill_purchase", {
      _internal_reference: row.internal_reference,
      _outcome: outcome,
      _provider_transaction_id: pay.transactionId ?? "",
      _payload: {
        vtpass_code: pay.code,
        vtpass_status: pay.contentStatus,
        response_description: pay.responseDescription,
        purchased_code: pay.purchasedCode,
        vtpass_snapshot: safePayload(pay.raw),
        provider_amount: providerAmount,
        pricing_rule_id: pricing.pricingRuleId,
        rockpay_fee: pricing.rockpayFee,
      },
    });
    if (finError) {
      console.error("[cable] complete", finError.message);
      return {
        status: "pending",
        reference: row.internal_reference as string,
        requestId: row.request_id as string,
        providerTransactionId: pay.transactionId,
        amount: customerAmount,
        identifierMasked: maskId(data.billersCode),
        provider: data.serviceID,
        product: pack.name,
        token: null,
        balanceAfter: row.balance_after != null ? Number(row.balance_after) : null,
        message: customerMessage("pending", "cable"),
        customerName: data.customerName ?? null,
      };
    }
    const fin = Array.isArray(finalized) ? finalized[0] : finalized;
    const status = (fin?.status ?? outcome) as BillPurchaseResult["status"];
    return {
      status,
      reference: (fin?.internal_reference ?? row.internal_reference) as string,
      requestId: row.request_id as string,
      providerTransactionId: pay.transactionId,
      amount: customerAmount,
      identifierMasked: maskId(data.billersCode),
      provider: data.serviceID,
      product: pack.name,
      token: pay.purchasedCode,
      balanceAfter: fin?.balance_after != null ? Number(fin.balance_after) : null,
      message: customerMessage(status, "cable", customerAmount, pay.responseDescription),
      customerName: data.customerName ?? null,
    };
  });
