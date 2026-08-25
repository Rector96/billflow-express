import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolvePricing } from "./pricing.server";
import { maybeRecordTransactionProfit } from "./transaction-profits.server";

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

function safePayload(raw: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function customerMessage(
  status: BillPurchaseResult["status"],
  slug: string,
  amount?: number,
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

/** Live DisCo / cable / data providers from VTpass catalogue (server-cached). */
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
    const { getVtpassConfig, vtpassListServices } =
      await import("./vtpass.server");

    getVtpassConfig();

    const services = await vtpassListServices(data.category);

    return services.map((s) => ({
      serviceID: s.serviceID,
      name: s.name,
      minimumAmount: s.minimumAmount,
      maximumAmount: s.maximumAmount,
    }));
  });

/** Live packages for a cable / data serviceID. */
export const listVtpassVariations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceID: string }) => {
    const serviceID = String(input?.serviceID ?? "").trim();

    if (!serviceID) throw new Error("Select a provider.");

    return { serviceID };
  })
  .handler(async ({ data }) => {
    const { getVtpassConfig, vtpassListVariations } =
      await import("./vtpass.server");

    getVtpassConfig();

    const variations = await vtpassListVariations(data.serviceID);

    return variations.map((v) => ({
      variationCode: v.variationCode,
      name: v.name,
      amount: v.amount,
      fixedPrice: v.fixedPrice,
    }));
  });

/** Verify smartcard or meter — server only. */
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

    const type = input?.type
      ? String(input.type).trim().toLowerCase()
      : undefined;

    if (type && type !== "prepaid" && type !== "postpaid") {
      throw new Error("Select prepaid or postpaid.");
    }

    return {
      serviceID,
      billersCode,
      type,
    };
  })
  .handler(async ({ data }) => {
    const { getVtpassConfig, vtpassMerchantVerify } =
      await import("./vtpass.server");

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
        result.message ||
          "Could not verify this number. Check and try again.",
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
      snapshot: result.raw,
    };
  });

/** Cable TV purchase via VTpass. */
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

    if (!/^\d{4}$/.test(pin)) {
      throw new Error("Enter your 4-digit PIN.");
    }

    return {
      serviceID,
      billersCode,
      variationCode,
      amount,
      pin,
      phone: input?.phone ? String(input.phone) : undefined,
      customerName: input?.customerName
        ? String(input.customerName)
        : undefined,
      subscriptionType: input?.subscriptionType
        ? String(input.subscriptionType)
        : "change",
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

    getVtpassConfig();

    const variations = await vtpassListVariations(data.serviceID);

    const pack = variations.find(
      (v) => v.variationCode === data.variationCode,
    );

    if (!pack) {
      throw new Error(
        "Selected package is no longer available. Refresh and try again.",
      );
    }

    const providerAmount = pack.fixedPrice
      ? Math.round(pack.amount)
      : data.amount;

    if (providerAmount < 50) {
      throw new Error("Enter a valid amount.");
    }

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

    if (!phone) {
      phone = "08011111111";
    }

    const { data: started, error: startError } =
      await context.supabase.rpc("start_bill_purchase", {
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

    console.info(
      "[cable] pay",
      row.internal_reference,
      pay.code,
      pay.contentStatus,
      outcome,
    );

    const { data: finalized, error: finError } =
      await context.supabase.rpc("complete_bill_purchase", {
        _internal_reference: row.internal_reference,
        _outcome: outcome,
        _provider_transaction_id: pay.transactionId ?? "",
        _payload: {
          vtpass_code: pay.code,
          vtpass_status: pay.contentStatus,
          response_description: pay.responseDescription,
          purchased_code: pay.purchasedCode,
          vtpass_snapshot: safePayload(pay.raw),
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
        balanceAfter:
          row.balance_after != null
            ? Number(row.balance_after)
            : null,
        message: customerMessage("pending", "cable"),
        customerName: data.customerName ?? null,
      };
    }

    const fin = Array.isArray(finalized) ? finalized[0] : finalized;

    const status =
      (fin?.status ?? outcome) as BillPurchaseResult["status"];

    if (status === "successful") {
      try {
        await maybeRecordTransactionProfit(context.supabase as never, {
          internalReference: row.internal_reference as string,
          customerAmount,
          providerAmount,
          rockpayFee: pricing.rockpayFee,
          pricingRuleId: pricing.pricingRuleId,
          service: "cable",
          provider: data.serviceID,
          productCode: data.variationCode,
          providerCost: providerAmount,
        });
      } catch (profitError) {
        console.error("[cable] profit", profitError);
      }
    }

    return {
      status,
      reference:
        (fin?.internal_reference ??
          row.internal_reference) as string,
      requestId: row.request_id as string,
      providerTransactionId: pay.transactionId,
      amount: customerAmount,
      identifierMasked: maskId(data.billersCode),
      provider: data.serviceID,
      product: pack.name,
      token: pay.purchasedCode,
      balanceAfter:
        fin?.balance_after != null
          ? Number(fin.balance_after)
          : null,
      message: customerMessage(status, "cable", customerAmount),
      customerName: data.customerName ?? null,
    };
  });

/** Electricity purchase via VTpass. */
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
  }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    const billersCode = String(input?.billersCode ?? "").replace(/\s/g, "");
    const meterType = String(input?.meterType ?? "")
      .trim()
      .toLowerCase();
    const amount = Math.round(Number(input?.amount));
    const pin = String(input?.pin ?? "");
    const minAmount =
      input?.minAmount != null ? Number(input.minAmount) : 0;

    if (!serviceID) throw new Error("Select a provider.");
    if (!billersCode) throw new Error("Enter your meter number.");

    if (meterType !== "prepaid" && meterType !== "postpaid") {
      throw new Error("Select prepaid or postpaid.");
    }

    if (!Number.isFinite(amount) || amount < 50) {
      throw new Error("Enter a valid amount.");
    }

    if (minAmount > 0 && amount < minAmount) {
      throw new Error(
        `Minimum amount is ₦${Math.round(minAmount).toLocaleString("en-NG")}.`,
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      throw new Error("Enter your 4-digit PIN.");
    }

    return {
      serviceID,
      billersCode,
      meterType,
      amount,
      pin,
      phone: input?.phone ? String(input.phone) : undefined,
      customerName: input?.customerName
        ? String(input.customerName)
        : undefined,
      minAmount,
    };
  })
  .handler(async ({ data, context }): Promise<BillPurchaseResult> => {
    const {
      getVtpassConfig,
      vtpassPay,
      mapVtpassOutcome,
      normalizeNgPhone,
      vtpassMerchantVerify,
    } = await import("./vtpass.server");

    getVtpassConfig();

    // Server-side meter gate — never trust client verification state
    const verified = await vtpassMerchantVerify({
      serviceID: data.serviceID,
      billersCode: data.billersCode,
      type: data.meterType,
    });

    if (!verified.ok) {
      throw new Error(
        verified.message ||
          "Meter verification failed. Please check the meter number and try again.",
      );
    }

    const resolvedCustomerName =
      verified.customerName ?? data.customerName ?? null;

    const resolvedMin =
      verified.minPurchaseAmount != null &&
      Number.isFinite(verified.minPurchaseAmount)
        ? Number(verified.minPurchaseAmount)
        : data.minAmount ?? 0;

    if (resolvedMin > 0 && data.amount < resolvedMin) {
      throw new Error(
        `Minimum amount is ₦${Math.round(resolvedMin).toLocaleString("en-NG")}.`,
      );
    }

    let phone = data.phone;

    try {
      if (phone) phone = normalizeNgPhone(phone);
    } catch {
      phone = undefined;
    }

    if (!phone) phone = "08011111111";

    const providerAmount = data.amount;
    const pricing = await resolvePricing({
      service: "electricity",
      provider: data.serviceID,
      productCode: data.meterType,
      baseAmount: providerAmount,
    });
    const customerAmount = pricing.customerAmount;

    const { data: started, error: startError } =
      await context.supabase.rpc("start_bill_purchase", {
        _service_slug: "electricity",
        _service_label: "Electricity",
        _provider: data.serviceID,
        _product: data.meterType,
        _customer_identifier: data.billersCode,
        _amount: customerAmount,
        _pin: data.pin,
        _metadata: {
          title: "Electricity Payment",
          service_slug: "electricity",
          service_label: `${data.serviceID} (${data.meterType})`,
          masked: maskId(data.billersCode),
          customer: resolvedCustomerName,
          meter_type: data.meterType,
          verified_at: new Date().toISOString(),
          provider_amount: providerAmount,
          pricing_rule_id: pricing.pricingRuleId,
          rockpay_fee: pricing.rockpayFee,
          pricing_fallback: pricing.usedFallback,
        },
      });

    if (startError) {
      console.error("[electricity] start", startError.message);
      throw mapStartError(startError.message);
    }

    const row = Array.isArray(started) ? started[0] : started;

    if (!row?.internal_reference || !row?.request_id) {
      throw new Error("Could not start electricity payment.");
    }

    const pay = await vtpassPay({
      request_id: row.request_id,
      serviceID: data.serviceID,
      billersCode: data.billersCode,
      variation_code: data.meterType,
      type: data.meterType,
      amount: providerAmount,
      phone,
    });

    const outcome = mapVtpassOutcome(pay);

    console.info(
      "[electricity] pay",
      row.internal_reference,
      pay.code,
      pay.contentStatus,
      outcome,
    );

    const { data: finalized, error: finError } =
      await context.supabase.rpc("complete_bill_purchase", {
        _internal_reference: row.internal_reference,
        _outcome: outcome,
        _provider_transaction_id: pay.transactionId ?? "",
        _payload: {
          vtpass_code: pay.code,
          vtpass_status: pay.contentStatus,
          response_description: pay.responseDescription,
          purchased_code: pay.purchasedCode,
          token: pay.purchasedCode,
          vtpass_snapshot: safePayload(pay.raw),
        },
      });

    if (finError) {
      console.error("[electricity] complete", finError.message);

      return {
        status: "pending",
        reference: row.internal_reference as string,
        requestId: row.request_id as string,
        providerTransactionId: pay.transactionId,
        amount: customerAmount,
        identifierMasked: maskId(data.billersCode),
        provider: data.serviceID,
        product: data.meterType,
        token: null,
        balanceAfter:
          row.balance_after != null
            ? Number(row.balance_after)
            : null,
        message: customerMessage("pending", "electricity"),
        customerName: resolvedCustomerName,
      };
    }

    const fin = Array.isArray(finalized) ? finalized[0] : finalized;

    const status =
      (fin?.status ?? outcome) as BillPurchaseResult["status"];

    if (status === "successful") {
      try {
        await maybeRecordTransactionProfit(context.supabase as never, {
          internalReference: row.internal_reference as string,
          customerAmount,
          providerAmount,
          rockpayFee: pricing.rockpayFee,
          pricingRuleId: pricing.pricingRuleId,
          service: "electricity",
          provider: data.serviceID,
          productCode: data.meterType,
          providerCost: providerAmount,
        });
      } catch (profitError) {
        console.error("[electricity] profit", profitError);
      }
    }

    return {
      status,
      reference:
        (fin?.internal_reference ??
          row.internal_reference) as string,
      requestId: row.request_id as string,
      providerTransactionId: pay.transactionId,
      amount: customerAmount,
      identifierMasked: maskId(data.billersCode),
      provider: data.serviceID,
      product: data.meterType,
      token: pay.purchasedCode,
      balanceAfter:
        fin?.balance_after != null
          ? Number(fin.balance_after)
          : null,
      message: customerMessage(status, "electricity", customerAmount),
      customerName: resolvedCustomerName,
    };
  });

/** Mobile Data purchase via VTpass (live catalogue variations). */
export const purchaseData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serviceID: string;
    phone: string;
    variationCode: string;
    amount?: number;
    pin: string;
  }) => {
    const serviceID = String(input?.serviceID ?? "").trim();
    const phone = String(input?.phone ?? "").trim();
    const variationCode = String(input?.variationCode ?? "").trim();
    const pin = String(input?.pin ?? "");

    if (!serviceID) throw new Error("Select a network.");
    if (!phone) throw new Error("Enter a phone number.");
    if (!variationCode) throw new Error("Select a data plan.");

    if (!/^\d{4}$/.test(pin)) {
      throw new Error("Enter your 4-digit PIN.");
    }

    return {
      serviceID,
      phone,
      variationCode,
      pin,
      amount:
        input?.amount != null
          ? Math.round(Number(input.amount))
          : undefined,
    };
  })
  .handler(async ({ data, context }): Promise<BillPurchaseResult> => {
    const {
      getVtpassConfig,
      vtpassListVariations,
      vtpassPay,
      mapVtpassOutcome,
      normalizeNgPhone,
      toVtpassDataServiceId,
      MOBILE_DATA_SERVICE_IDS,
    } = await import("./vtpass.server");

    getVtpassConfig();

    let serviceID: string;

    try {
      serviceID = MOBILE_DATA_SERVICE_IDS.has(data.serviceID)
        ? data.serviceID
        : toVtpassDataServiceId(data.serviceID);
    } catch {
      throw new Error("Select a supported network.");
    }

    const phone = normalizeNgPhone(data.phone);

    const variations = await vtpassListVariations(serviceID);

    const pack = variations.find(
      (v) => v.variationCode === data.variationCode,
    );

    if (!pack) {
      throw new Error(
        "Selected plan is no longer available. Refresh and try again.",
      );
    }

    const providerAmount = Math.round(pack.amount);

    if (!Number.isFinite(providerAmount) || providerAmount < 50) {
      throw new Error("Enter a valid amount.");
    }

    const networkLabel = serviceID
      .replace(/-data$/i, "")
      .replace(/etisalat/i, "9mobile")
      .toUpperCase();

    const pricing = await resolvePricing({
      service: "data",
      provider: serviceID,
      productCode: data.variationCode,
      baseAmount: providerAmount,
    });
    const customerAmount = pricing.customerAmount;

    const { data: started, error: startError } =
      await context.supabase.rpc("start_bill_purchase", {
        _service_slug: "data",
        _service_label: "Data",
        _provider: serviceID,
        _product: pack.name,
        _customer_identifier: phone,
        _amount: customerAmount,
        _pin: data.pin,
        _metadata: {
          title: "Data Purchase",
          service_slug: "data",
          service_label: `${networkLabel} ${pack.name}`,
          masked: maskPhone(phone),
          variation_code: data.variationCode,
          network: networkLabel,
          provider_amount: providerAmount,
          pricing_rule_id: pricing.pricingRuleId,
          rockpay_fee: pricing.rockpayFee,
          pricing_fallback: pricing.usedFallback,
        },
      });

    if (startError) {
      console.error("[data] start", startError.message);
      throw mapStartError(startError.message);
    }

    const row = Array.isArray(started) ? started[0] : started;

    if (!row?.internal_reference || !row?.request_id) {
      throw new Error("Could not start data purchase.");
    }

    const pay = await vtpassPay({
      request_id: row.request_id,
      serviceID,
      billersCode: phone,
      variation_code: data.variationCode,
      amount: providerAmount,
      phone,
    });

    const outcome = mapVtpassOutcome(pay);

    console.info(
      "[data] pay",
      row.internal_reference,
      pay.code,
      pay.contentStatus,
      outcome,
    );

    const { data: finalized, error: finError } =
      await context.supabase.rpc("complete_bill_purchase", {
        _internal_reference: row.internal_reference,
        _outcome: outcome,
        _provider_transaction_id: pay.transactionId ?? "",
        _payload: {
          vtpass_code: pay.code,
          vtpass_status: pay.contentStatus,
          response_description: pay.responseDescription,
          purchased_code: pay.purchasedCode,
          vtpass_snapshot: safePayload(pay.raw),
        },
      });

    if (finError) {
      console.error("[data] complete", finError.message);

      return {
        status: "pending",
        reference: row.internal_reference as string,
        requestId: row.request_id as string,
        providerTransactionId: pay.transactionId,
        amount: customerAmount,
        identifierMasked: maskPhone(phone),
        provider: serviceID,
        product: pack.name,
        token: null,
        balanceAfter:
          row.balance_after != null
            ? Number(row.balance_after)
            : null,
        message: customerMessage("pending", "data"),
        customerName: null,
      };
    }

    const fin = Array.isArray(finalized) ? finalized[0] : finalized;

    const status =
      (fin?.status ?? outcome) as BillPurchaseResult["status"];

    if (status === "successful") {
      try {
        await maybeRecordTransactionProfit(context.supabase as never, {
          internalReference: row.internal_reference as string,
          customerAmount,
          providerAmount,
          rockpayFee: pricing.rockpayFee,
          pricingRuleId: pricing.pricingRuleId,
          service: "data",
          provider: serviceID,
          productCode: data.variationCode,
          providerCost: providerAmount,
        });
      } catch (profitError) {
        console.error("[data] profit", profitError);
      }
    }

    return {
      status,
      reference:
        (fin?.internal_reference ??
          row.internal_reference) as string,
      requestId: row.request_id as string,
      providerTransactionId: pay.transactionId,
      amount: customerAmount,
      identifierMasked: maskPhone(phone),
      provider: serviceID,
      product: pack.name,
      token: pay.purchasedCode,
      balanceAfter:
        fin?.balance_after != null
          ? Number(fin.balance_after)
          : null,
      message: customerMessage(status, "data", customerAmount),
      customerName: null,
    };
  });

/** Customer requery for cable/electricity/data. */
export const requeryBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    const reference = String(input?.reference ?? "").trim();

    if (!reference) {
      throw new Error("Missing transaction reference.");
    }

    return { reference };
  })
  .handler(async ({ data, context }): Promise<BillPurchaseResult> => {
    const { vtpassRequery, mapVtpassOutcome } =
      await import("./vtpass.server");

    const { data: bills, error } = await context.supabase
      .from("bill_transactions")
      .select(
        "id, internal_reference, status, amount, provider, product, customer_identifier, provider_request_id, provider_transaction_id, user_id, metadata",
      )
      .eq("internal_reference", data.reference)
      .limit(1);

    if (error) throw new Error(error.message);

    const bill = bills?.[0];

    if (!bill) {
      throw new Error("Transaction not found.");
    }

    if (bill.user_id && bill.user_id !== context.userId) {
      throw new Error("Transaction not found.");
    }

    const meta = (bill.metadata ?? {}) as Record<string, unknown>;
    const slug = String(meta["service_slug"] ?? "bill");
    const customerAmount = Number(bill.amount);
    const providerAmountValue = meta["provider_amount"];
    const providerAmount =
      providerAmountValue != null && providerAmountValue !== "" &&
      Number.isFinite(Number(providerAmountValue))
        ? Number(providerAmountValue)
        : null;
    const profitService =
      slug === "data" || slug === "cable" || slug === "electricity"
        ? slug
        : null;

    const recordProfitIfApplicable = async (status: string) => {
      if (
        status !== "successful" ||
        providerAmount == null ||
        profitService == null
      ) return;

      try {
        await maybeRecordTransactionProfit(context.supabase as never, {
          internalReference: bill.internal_reference,
          customerAmount,
          providerAmount,
          rockpayFee:
            meta["rockpay_fee"] != null
              ? Number(meta["rockpay_fee"])
              : null,
          pricingRuleId:
            typeof meta["pricing_rule_id"] === "string"
              ? meta["pricing_rule_id"]
              : null,
          service: profitService,
          provider: bill.provider ? String(bill.provider) : null,
          productCode:
            typeof meta["variation_code"] === "string"
              ? meta["variation_code"]
              : bill.product,
          providerCost: providerAmount,
        });
      } catch (profitError) {
        console.error("[bill] profit", profitError);
      }
    };

    const tokenExisting =
      typeof meta["token"] === "string"
        ? meta["token"]
        : typeof meta["purchased_code"] === "string"
          ? meta["purchased_code"]
          : null;

    const idMasked =
      slug === "data"
        ? maskPhone(String(bill.customer_identifier ?? ""))
        : maskId(String(bill.customer_identifier ?? ""));

    if (
      bill.status === "successful" ||
      bill.status === "failed"
    ) {
      await recordProfitIfApplicable(bill.status);

      return {
        status: bill.status as "successful" | "failed",
        reference: bill.internal_reference,
        requestId: bill.provider_request_id ?? "",
        providerTransactionId: bill.provider_transaction_id,
        amount: customerAmount,
        identifierMasked: idMasked,
        provider: String(bill.provider ?? ""),
        product: bill.product,
        token: tokenExisting,
        balanceAfter: null,
        message: customerMessage(
          bill.status as "successful" | "failed",
          slug,
          customerAmount,
        ),
        customerName:
          typeof meta["customer"] === "string"
            ? meta["customer"]
            : null,
      };
    }

    if (!bill.provider_request_id) {
      throw new Error(
        "We couldn't confirm this payment yet. Your money is still protected. Check again shortly or contact RockPay Care.",
      );
    }

    const pay = await vtpassRequery(
      bill.provider_request_id,
    );

    const outcome = mapVtpassOutcome(pay);

    console.info(
      "[bill] requery",
      data.reference,
      pay.code,
      pay.contentStatus,
      outcome,
    );

    const { data: finalized, error: finError } =
      await context.supabase.rpc("complete_bill_purchase", {
        _internal_reference: bill.internal_reference,
        _outcome: outcome,
        _provider_transaction_id:
          pay.transactionId ??
          bill.provider_transaction_id ??
          "",
        _payload: {
          vtpass_code: pay.code,
          vtpass_status: pay.contentStatus,
          response_description: pay.responseDescription,
          purchased_code: pay.purchasedCode,
          token: pay.purchasedCode,
          requery: true,
          vtpass_snapshot: safePayload(pay.raw),
        },
      });

    if (finError) {
      throw new Error(finError.message);
    }

    const fin = Array.isArray(finalized)
      ? finalized[0]
      : finalized;

    const status =
      (fin?.status ?? outcome) as BillPurchaseResult["status"];

    await recordProfitIfApplicable(status);

    return {
      status,
      reference: bill.internal_reference,
      requestId: bill.provider_request_id,
      providerTransactionId:
        pay.transactionId ??
        bill.provider_transaction_id,
      amount: customerAmount,
      identifierMasked: idMasked,
      provider: String(bill.provider ?? ""),
      product: bill.product,
      token: pay.purchasedCode ?? tokenExisting,
      balanceAfter:
        fin?.balance_after != null
          ? Number(fin.balance_after)
          : null,
      message: customerMessage(status, slug, customerAmount),
      customerName:
        typeof meta["customer"] === "string"
          ? meta["customer"]
          : null,
    };
  });
