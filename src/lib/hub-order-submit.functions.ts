/**
 * CAC & NIN applications → hub_orders + staff/user notify + Resend.
 *
 * Payment rules:
 * - If PAYSTACK_SECRET_KEY is set: require a real Paystack reference and verify it.
 * - Demo refs (PSK_DEMO_*) only when HUB_ALLOW_UNVERIFIED_PAY=true or
 *   HUB_PREVIEW_FLOWS allows unverified pay (see hub-preview.server).
 * - Webhook path remains the secondary recorder (idempotent on payment_reference).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyStaffNewHubOrder } from "@/lib/hub-documents.functions";
import { sendHubLifecycleEmail } from "@/lib/hub-email.server";
import { notifyUser } from "@/lib/hub-notify.server";
import { isHubPreviewServerEnabled } from "@/lib/hub-preview.server";
import { SERVICE_PRICES } from "@/lib/hub-service-prices";
import { isBillLive } from "@/lib/product-mode";

function paystackSecret(): string {
  return String(process.env["PAYSTACK_SECRET_KEY"] ?? "").trim();
}

export const submitCacApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentReference: string }) => {
    const paymentReference = String(input?.paymentReference ?? "").trim();
    if (!/^RP-HUB-[A-F0-9]{32}$/.test(paymentReference)) {
      throw new Error("A valid RockPay payment reference is required.");
    }
    return { paymentReference };
  })
  .handler(async ({ data, context }) => {
    if (!isBillLive("cac") && !isHubPreviewServerEnabled()) {
      throw new Error("CAC registration is not available right now.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- hub_payment_intents is not yet in generated Supabase types.
    const admin = supabaseAdmin as any;
    const { data: intent, error: intentError } = await admin
      .from("hub_payment_intents")
      .select(
        "id,user_id,service,amount_kobo,currency,payment_reference,paystack_domain,status,order_payload,provider_transaction_id",
      )
      .eq("payment_reference", data.paymentReference)
      .maybeSingle();

    if (intentError || !intent) throw new Error("The payment request could not be found.");
    if (intent.user_id !== context.userId || intent.service !== "cac") {
      throw new Error("This payment request does not belong to your CAC application.");
    }

    const payload = intent.order_payload as Record<string, unknown>;
    const expectedKobo = Number(intent.amount_kobo);
    if (!Number.isSafeInteger(expectedKobo) || expectedKobo <= 0 || intent.currency !== "NGN") {
      throw new Error("The saved CAC payment amount is invalid.");
    }

    const secret = paystackSecret();
    const expectedPrefix = intent.paystack_domain === "test" ? "sk_test_" : "sk_live_";
    if (!secret.startsWith(expectedPrefix)) {
      throw new Error("The Paystack environment does not match this payment request.");
    }

    const { paystackVerify, classifyPaystackFunding } = await import("@/lib/paystack.server");
    const transaction = await paystackVerify(data.paymentReference);
    if (!transaction || String(transaction.status ?? "").toLowerCase() !== "success") {
      throw new Error("Could not verify a successful CAC payment with Paystack.");
    }
    if (transaction.domain && transaction.domain !== intent.paystack_domain) {
      throw new Error("The Paystack transaction environment does not match this payment request.");
    }
    const classification = classifyPaystackFunding(
      transaction,
      data.paymentReference,
      expectedKobo,
    );
    if (classification.kind === "mismatch") {
      throw new Error("Paystack payment details do not match the saved CAC payment request.");
    }
    const providerTransactionId = Number(classification.providerTransactionId);
    if (!Number.isSafeInteger(providerTransactionId) || providerTransactionId <= 0) {
      throw new Error("Paystack returned an invalid transaction identifier.");
    }

    const { data: finalized, error: finalizeError } = await admin.rpc(
      "finalize_hub_payment_intent",
      {
        _payment_reference: data.paymentReference,
        _provider_transaction_id: providerTransactionId,
        _paid_at: transaction.paid_at ?? transaction.paidAt ?? new Date().toISOString(),
      },
    );
    if (finalizeError) {
      console.error("[hub-cac] atomic payment finalization failed", finalizeError.message);
      throw new Error(
        "Payment was verified, but the application confirmation is still processing. Please contact support with your payment reference.",
      );
    }

    const finalRow = Array.isArray(finalized) ? finalized[0] : finalized;
    if (!finalRow?.tracking_reference) {
      throw new Error("Payment was verified, but the application order could not be confirmed.");
    }

    const finalPayload = (finalRow.order_payload ?? payload) as Record<string, unknown>;
    const delivery = finalPayload.delivery === "deliver" ? "deliver" : "download";
    const preferredName = String(finalPayload.preferredName ?? "");
    const trackingReference = String(finalRow.tracking_reference);
    const amount = Number(finalRow.amount ?? expectedKobo / 100);
    const wasExisting = Boolean(finalRow.was_existing);

    if (!wasExisting) {
      await notifyStaffNewHubOrder({
        service: "cac",
        amount,
        orderHint: preferredName,
      });
      await notifyUser({
        userId: context.userId,
        title: "CAC application received",
        message:
          delivery === "deliver"
            ? "We received your application. We’ll process it and deliver the printed pack to your address."
            : "We received your application. You’ll be notified when the certificate is ready to download.",
        type: "success",
      });
      void sendHubLifecycleEmail({
        userId: context.userId,
        event: "paid",
        eventKey: `hub-payment:${data.paymentReference}:paid:email`,
        service: "cac",
        trackingReference,
        amount,
      });
    }

    return {
      ok: true as const,
      trackingReference,
      paymentReference: data.paymentReference,
      amount,
      demo: false,
    };
  });

export const submitNinOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input)
  .handler(async () => {
    // NIN remains unavailable until secure payment intents, idempotent
    // payment finalization, and real provider fulfilment are implemented.
    throw new Error(
      "NIN checkout is temporarily unavailable while secure payment and fulfilment are being prepared.",
    );
  });

export const CAC_DEFAULT_AMOUNT = SERVICE_PRICES.cac_registration;
