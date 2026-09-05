/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type DirectInitResult = {
  billReference: string;
  paystackReference: string;
  authorizationUrl: string;
  amount: number;
};

export type DirectVerifyResult = {
  billReference: string;
  status: "successful" | "pending" | "failed";
  amount: number;
  token: string | null;
  message: string;
  providerTransactionId: string | null;
};

function safePayload(raw: unknown): Json {
  try {
    return JSON.parse(JSON.stringify(raw)) as Json;
  } catch {
    return {};
  }
}

function resolveDirectCallbackUrl(): string | undefined {
  const siteUrl = (
    process.env["URL"] ??
    process.env["DEPLOY_PRIME_URL"] ??
    process.env["SITE_URL"] ??
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (siteUrl.startsWith("http")) return `${siteUrl}/pay/complete`;
  const origin = getRequestHeader("origin")?.trim();
  if (origin?.startsWith("http")) return `${origin.replace(/\/$/, "")}/pay/complete`;
  const referer = getRequestHeader("referer")?.trim();
  if (referer?.startsWith("http")) {
    try {
      const u = new URL(referer);
      return `${u.origin}/pay/complete`;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

type DirectOrderInput = {
  slug: "electricity" | "cable";
  serviceID: string;
  billersCode: string;
  amount: number;
  meterType?: string;
  variationCode?: string;
  phone?: string;
  customerName?: string;
  requestId?: string;
  subscriptionType?: string;
};

export const initializeDirectBillPay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: DirectOrderInput) => {
    const slug =
      input?.slug === "cable" ? "cable" : input?.slug === "electricity" ? "electricity" : null;
    if (!slug) throw new Error("Unsupported bill type.");
    const serviceID = String(input?.serviceID ?? "").trim();
    const billersCode = String(input?.billersCode ?? "").replace(/\s/g, "");
    const amount = Math.round(Number(input?.amount));
    if (!serviceID || !billersCode || !Number.isFinite(amount) || amount < 50) {
      throw new Error("Invalid payment details.");
    }
    if (slug === "electricity") {
      const meterType = String(input?.meterType ?? "")
        .trim()
        .toLowerCase();
      if (meterType !== "prepaid" && meterType !== "postpaid")
        throw new Error("Select prepaid or postpaid.");
      return {
        slug,
        serviceID,
        billersCode,
        amount,
        meterType,
        phone: input?.phone ? String(input.phone) : undefined,
        customerName: input?.customerName ? String(input.customerName) : undefined,
        requestId: String(input?.requestId ?? "").trim() || `direct-${crypto.randomUUID()}`,
      };
    }
    const variationCode = String(input?.variationCode ?? "").trim();
    if (!variationCode) throw new Error("Select a package.");
    return {
      slug,
      serviceID,
      billersCode,
      amount,
      variationCode,
      phone: input?.phone ? String(input.phone) : undefined,
      customerName: input?.customerName ? String(input.customerName) : undefined,
      subscriptionType: String(input?.subscriptionType ?? "change"),
      requestId: String(input?.requestId ?? "").trim() || `direct-${crypto.randomUUID()}`,
    };
  })
  .handler(async ({ data, context }): Promise<DirectInitResult> => {
    const { getPaystackSecret } = await import("./paystack.server");
    const { getVtpassConfig, vtpassListVariations, vtpassMerchantVerify } =
      await import("./vtpass.server");
    const { resolvePricing } = await import("./pricing.server");
    getPaystackSecret();
    getVtpassConfig();

    if (data.slug === "electricity") {
      const meterType = (data as { meterType: string }).meterType;
      const verified = await vtpassMerchantVerify({
        serviceID: data.serviceID,
        billersCode: data.billersCode,
        type: meterType,
      });
      if (!verified.ok || !verified.customerName) {
        throw new Error(verified.message || "Meter verification failed.");
      }
      if (verified.minPurchaseAmount && data.amount < verified.minPurchaseAmount) {
        throw new Error("Amount is below the provider minimum.");
      }
      const pricing = await resolvePricing({
        service: "electricity",
        provider: data.serviceID,
        productCode: meterType,
        baseAmount: data.amount,
      });
      const { data: started, error } = await context.supabase.rpc("start_direct_bill_order", {
        _service_slug: "electricity",
        _service_label: "Electricity",
        _provider: data.serviceID,
        _product: meterType,
        _customer_identifier: data.billersCode,
        _amount: pricing.customerAmount,
        _metadata: {
          title: "Electricity Payment",
          service_slug: "electricity",
          meter_type: meterType,
          provider_amount: data.amount,
          pricing_rule_id: pricing.pricingRuleId,
          rockpay_fee: pricing.rockpayFee,
          customer: verified.customerName,
          variation_code: meterType,
          phone: data.phone ?? null,
        },
        _request_id: data.requestId,
      });
      if (error) throw new Error(error.message);
      const row = Array.isArray(started) ? started[0] : started;
      if (!row?.paystack_reference || !row?.internal_reference) {
        throw new Error("Could not create payment order.");
      }
      return await initPaystackForOrder({
        context,
        amount: Number(row.amount),
        paystackReference: String(row.paystack_reference),
        billReference: String(row.internal_reference),
        metadata: {
          purpose: "direct_bill",
          bill_reference: String(row.internal_reference),
          service_slug: "electricity",
        },
      });
    }

    const variationCode = (data as { variationCode: string }).variationCode;
    const variations = await vtpassListVariations(data.serviceID);
    const pack = variations.find((v) => v.variationCode === variationCode);
    if (!pack) throw new Error("Selected package is no longer available.");
    const providerAmount = Math.round(pack.amount);
    const pricing = await resolvePricing({
      service: "cable",
      provider: data.serviceID,
      productCode: variationCode,
      baseAmount: providerAmount,
    });
    const { data: started, error } = await context.supabase.rpc("start_direct_bill_order", {
      _service_slug: "cable",
      _service_label: "Cable TV",
      _provider: data.serviceID,
      _product: pack.name,
      _customer_identifier: data.billersCode,
      _amount: pricing.customerAmount,
      _metadata: {
        title: "Cable TV Payment",
        service_slug: "cable",
        variation_code: variationCode,
        provider_amount: providerAmount,
        pricing_rule_id: pricing.pricingRuleId,
        rockpay_fee: pricing.rockpayFee,
        customer: data.customerName ?? null,
        subscription_type: (data as { subscriptionType?: string }).subscriptionType ?? "change",
        phone: data.phone ?? null,
      },
      _request_id: data.requestId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(started) ? started[0] : started;
    if (!row?.paystack_reference || !row?.internal_reference) {
      throw new Error("Could not create payment order.");
    }
    return await initPaystackForOrder({
      context,
      amount: Number(row.amount),
      paystackReference: String(row.paystack_reference),
      billReference: String(row.internal_reference),
      metadata: {
        purpose: "direct_bill",
        bill_reference: String(row.internal_reference),
        service_slug: "cable",
      },
    });
  });

async function initPaystackForOrder(opts: {
  context: { supabase: any; userId: string };
  amount: number;
  paystackReference: string;
  billReference: string;
  metadata: Record<string, string>;
}): Promise<DirectInitResult> {
  const { getPaystackSecret, PAYSTACK_API } = await import("./paystack.server");
  const secret = getPaystackSecret();
  const { data: profile } = await opts.context.supabase
    .from("profiles")
    .select("email")
    .eq("id", opts.context.userId)
    .maybeSingle();
  const email = (profile?.email ?? "").trim();
  if (!email) {
    throw new Error(
      "Your account has no email on file. Update your profile email, then try again.",
    );
  }
  const callbackUrl = resolveDirectCallbackUrl();
  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(opts.amount * 100),
      currency: "NGN",
      reference: opts.paystackReference,
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      metadata: { ...opts.metadata, user_id: opts.context.userId, mode: "test" },
    }),
  });
  const json = (await res.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string };
  } | null;
  if (!res.ok || !json?.status || !json.data?.authorization_url) {
    throw new Error(json?.message ?? `Paystack initialize failed (HTTP ${res.status})`);
  }
  return {
    billReference: opts.billReference,
    paystackReference: opts.paystackReference,
    authorizationUrl: json.data.authorization_url,
    amount: opts.amount,
  };
}

export const verifyAndFulfillDirectBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    const reference = String(input?.reference ?? "").trim();
    if (!/^DIR-[A-Z0-9]{4,32}$/i.test(reference) && !/^BIL-[A-Z0-9]{4,32}$/i.test(reference)) {
      throw new Error("Invalid payment reference.");
    }
    return { reference };
  })
  .handler(async ({ data, context }): Promise<DirectVerifyResult> => {
    const { paystackVerify } = await import("./paystack.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeNgPhone } = await import("./vtpass.server");
    const { routeElectricityPay, routeCablePay, toVtpassShape } =
      await import("./vendor-router.server");

    let q = supabaseAdmin
      .from("bill_transactions")
      .select("*")
      .eq("user_id", context.userId)
      .limit(1);
    const ref = data.reference;
    q = ref.toUpperCase().startsWith("DIR-")
      ? q.eq("external_reference", ref)
      : q.eq("internal_reference", ref);
    const { data: rows, error: loadErr } = await q;
    if (loadErr) throw new Error(loadErr.message);
    const bill = rows?.[0];
    if (!bill) throw new Error("Payment order not found.");
    if ((bill.metadata as any)?.payment_mode !== "direct_paystack") {
      throw new Error("This is not a direct bill payment.");
    }

    const billRef = bill.internal_reference as string;
    const paystackRef = (bill.external_reference ||
      (bill.metadata as any)?.paystack_reference) as string;
    const amount = Number(bill.amount);
    const meta = (bill.metadata ?? {}) as Record<string, unknown>;
    const slug = String(meta.service_slug ?? "").toLowerCase();

    if (bill.status === "successful") {
      return {
        billReference: billRef,
        status: "successful",
        amount,
        token: (meta.token as string) || (meta.purchased_code as string) || null,
        message: "Payment already completed.",
        providerTransactionId: bill.provider_transaction_id,
      };
    }

    const ps = await paystackVerify(paystackRef);
    if (!ps) {
      return {
        billReference: billRef,
        status: "pending",
        amount,
        token: null,
        message: "Waiting for Paystack confirmation.",
        providerTransactionId: null,
      };
    }

    const gatewayStatus = String(ps.status ?? "").toLowerCase();
    const expectedKobo = Math.round(amount * 100);
    if (gatewayStatus !== "success") {
      const failed = gatewayStatus === "failed" || gatewayStatus === "abandoned";
      if (failed) {
        await (supabaseAdmin as any).rpc("trusted_complete_direct_bill_purchase", {
          _user_id: context.userId,
          _internal_reference: billRef,
          _outcome: "failed",
          _provider_transaction_id: "",
          _payload: { gateway_status: gatewayStatus, reason: "paystack_not_success" },
        });
        return {
          billReference: billRef,
          status: "failed",
          amount,
          token: null,
          message: "Payment did not succeed on Paystack.",
          providerTransactionId: null,
        };
      }
      return {
        billReference: billRef,
        status: "pending",
        amount,
        token: null,
        message: "Payment is still pending on Paystack.",
        providerTransactionId: null,
      };
    }

    if (
      ps.currency !== "NGN" ||
      Number(ps.amount) !== expectedKobo ||
      String(ps.reference) !== paystackRef
    ) {
      await (supabaseAdmin as any).rpc("trusted_complete_direct_bill_purchase", {
        _user_id: context.userId,
        _internal_reference: billRef,
        _outcome: "failed",
        _provider_transaction_id: "",
        _payload: { reason: "paystack_validation_mismatch" },
      });
      return {
        billReference: billRef,
        status: "failed",
        amount,
        token: null,
        message: "Payment validation failed. Contact Care with your reference.",
        providerTransactionId: null,
      };
    }

    let phone = "08011111111";
    if (meta.phone) {
      try {
        phone = normalizeNgPhone(String(meta.phone));
      } catch {
        /* sandbox */
      }
    }

    const providerRequestId = bill.provider_request_id as string;
    const serviceID = bill.provider as string;
    const billersCode = bill.customer_identifier as string;
    const providerAmount = Number(meta.provider_amount ?? amount);

    let routed;
    if (slug === "electricity") {
      const meterType = String(meta.meter_type ?? bill.product ?? "prepaid");
      routed = await routeElectricityPay({
        request_id: providerRequestId,
        serviceID,
        billersCode,
        meterType,
        amount: providerAmount,
        phone,
      });
    } else {
      const variationCode = String(meta.variation_code ?? "");
      routed = await routeCablePay({
        request_id: providerRequestId,
        serviceID,
        billersCode,
        variation_code: variationCode,
        amount: providerAmount,
        phone,
        subscription_type: String(meta.subscription_type ?? "change"),
      });
    }

    const pay = toVtpassShape(routed);
    const outcome = routed.status;
    const { data: finalized, error: finErr } = await (supabaseAdmin as any).rpc(
      "trusted_complete_direct_bill_purchase",
      {
        _user_id: context.userId,
        _internal_reference: billRef,
        _outcome: outcome,
        _provider_transaction_id: pay.transactionId ?? "",
        _payload: {
          vtpass_code: pay.code,
          vtpass_status: pay.contentStatus,
          response_description: pay.responseDescription,
          purchased_code: pay.purchasedCode,
          vtpass_fulfilled: true,
          paystack_id: ps.id ? String(ps.id) : null,
          vendor: routed.vendor,
          fallback_used: routed.fallbackUsed,
          vtpass_snapshot: safePayload(pay.raw),
        },
      },
    );
    if (finErr) console.error("[direct-bill] complete", finErr.message);

    const fin = Array.isArray(finalized) ? finalized[0] : finalized;
    const status = (fin?.status ?? outcome) as DirectVerifyResult["status"];

    if (status === "successful") {
      try {
        const { maybeRecordTransactionProfit } = await import("./transaction-profits.server");
        await maybeRecordTransactionProfit(supabaseAdmin as any, {
          internalReference: billRef,
          customerAmount: amount,
          providerAmount,
          rockpayFee: meta.rockpay_fee != null ? Number(meta.rockpay_fee) : null,
          pricingRuleId: meta.pricing_rule_id ? String(meta.pricing_rule_id) : null,
          service: slug === "cable" ? "cable" : "electricity",
          provider: serviceID,
          productCode: String(meta.variation_code ?? meta.meter_type ?? ""),
          providerCost: pay.totalAmount,
          providerCommission: pay.commission,
        });
      } catch (e) {
        console.error("[direct-bill] profit", e);
      }
    }

    const msg =
      status === "successful"
        ? slug === "electricity"
          ? "Electricity payment successful."
          : "Cable payment successful."
        : status === "failed"
          ? "Provider could not complete this bill. Open Care with your reference for help."
          : "Still confirming with the provider.";

    return {
      billReference: billRef,
      status,
      amount,
      token: pay.purchasedCode,
      message: msg,
      providerTransactionId: pay.transactionId,
    };
  });
