import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Paystack webhook for RockPay.
 *
 * Wallet deposits are settled only after verifyAndSettle independently verifies
 * the transaction with Paystack. Hub orders are recorded by authenticated
 * server functions after checking the signed-in customer and expected amount.
 *
 * The webhook intentionally does not create hub_orders from payment metadata:
 * metadata is supplied during checkout and is not a trusted order-intent record.
 */
export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";

        console.info("[paystack-webhook] received", {
          bytes: raw.length,
          hasSignature: Boolean(signature),
        });

        let secret: string;
        try {
          const { getPaystackSecret } = await import("@/lib/paystack.server");
          secret = getPaystackSecret();
        } catch (err) {
          console.error("[paystack-webhook] not configured", (err as Error).message);
          return new Response("Not configured", { status: 503 });
        }

        // Paystack sends a 128-character hexadecimal HMAC-SHA512 signature.
        if (!/^[a-f0-9]{128}$/i.test(signature)) {
          console.warn("[paystack-webhook] invalid signature format");
          return new Response("Invalid signature", { status: 401 });
        }

        const expected = createHmac("sha512", secret).update(raw).digest();
        const received = Buffer.from(signature, "hex");
        if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
          console.warn("[paystack-webhook] invalid signature");
          return new Response("Invalid signature", { status: 401 });
        }

        let event: PaystackWebhookEvent;
        try {
          event = JSON.parse(raw) as PaystackWebhookEvent;
        } catch {
          console.warn("[paystack-webhook] bad JSON");
          return new Response("Bad payload", { status: 400 });
        }

        const eventName = String(event.event ?? "");
        const reference = String(event.data?.reference ?? "").trim();
        console.info("[paystack-webhook] event", { eventName, reference });

        const supported = ["charge.success", "charge.failed", "transfer.failed"];
        if (!eventName || !supported.includes(eventName) || !reference) {
          console.info("[paystack-webhook] ignored event");
          return new Response("ignored", { status: 200 });
        }

        try {
          const { verifyAndSettle } = await import("@/lib/paystack.server");
          await verifyAndSettle(reference);
          console.info("[paystack-webhook] wallet settlement checked", reference);
        } catch (err) {
          const message = (err as Error).message ?? "";
          if (message.includes("Unknown funding reference")) {
            const handled = await reconcileHubPayment(reference);
            if (!handled) {
              console.info("[paystack-webhook] no wallet or Hub payment intent", reference);
            }
            return new Response("ok", { status: 200 });
          }

          console.error("[paystack-webhook] wallet settlement failed", message);
          // Transient Paystack/API/database errors should be retried by Paystack.
          return new Response("Retry settlement", { status: 503 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

async function reconcileHubPayment(reference: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payment intent table is newly migrated.
  const admin = supabaseAdmin as any;
  const { data: intent, error } = await admin
    .from("hub_payment_intents")
    .select("id,service,amount_kobo,currency,paystack_domain,status,provider_transaction_id")
    .eq("payment_reference", reference)
    .maybeSingle();

  if (error) throw new Error(`Could not load Hub payment intent: ${error.message}`);
  if (!intent) return false;
  if (intent.service !== "cac" || intent.currency !== "NGN") {
    throw new Error("Unsupported Hub payment intent service or currency.");
  }

  const { getPaystackSecret, paystackVerify, classifyPaystackFunding } =
    await import("@/lib/paystack.server");
  const secret = getPaystackSecret();
  const expectedDomain = secret.startsWith("sk_test_") ? "test" : "live";
  if (intent.paystack_domain !== expectedDomain) {
    throw new Error("Hub payment intent environment does not match Paystack secret.");
  }

  const transaction = await paystackVerify(reference);
  if (!transaction)
    throw new Error("Paystack transaction verification is temporarily unavailable.");
  const verifiedStatus = String(transaction.status ?? "").toLowerCase();
  if (verifiedStatus !== "success") {
    // Only mark a payment failed when Paystack's verification endpoint confirms
    // a terminal failed/abandoned state. Pending states remain retryable.
    if (verifiedStatus === "failed" || verifiedStatus === "abandoned") {
      const { error: updateError } = await admin
        .from("hub_payment_intents")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", intent.id)
        .eq("status", "pending");
      if (updateError) {
        throw new Error(`Could not record verified Hub payment failure: ${updateError.message}`);
      }
    }
    // A signed event alone is not proof of a successful charge.
    return true;
  }
  if (transaction.domain && transaction.domain !== expectedDomain) {
    throw new Error("Paystack transaction domain mismatch.");
  }

  const classification = classifyPaystackFunding(
    transaction,
    reference,
    Number(intent.amount_kobo),
  );
  if (classification.kind === "mismatch") {
    console.error("[paystack-webhook] Hub payment rejected", {
      reference,
      transactionId: transaction.id ?? null,
      reason: classification.reason,
    });
    return true;
  }

  const providerTransactionId = Number(classification.providerTransactionId);
  if (!Number.isSafeInteger(providerTransactionId) || providerTransactionId <= 0) {
    throw new Error("Invalid Paystack transaction identifier.");
  }

  const { data: finalized, error: finalizeError } = await admin.rpc("finalize_hub_payment_intent", {
    _payment_reference: reference,
    _provider_transaction_id: providerTransactionId,
    _paid_at: transaction.paid_at ?? transaction.paidAt ?? new Date().toISOString(),
  });
  if (finalizeError) throw new Error(`Hub payment finalization failed: ${finalizeError.message}`);

  const order = Array.isArray(finalized) ? finalized[0] : finalized;
  if (!order?.tracking_reference || !order?.user_id) {
    throw new Error("Hub payment was finalized but the order details were not returned.");
  }

  // Always attempt the idempotent notifications, including when a previous
  // webhook already finalized the payment. This recovers transient insert failures.
  const payload = (order.order_payload ?? {}) as Record<string, unknown>;
  const delivery = payload.delivery === "deliver" ? "deliver" : "download";
  const preferredName = String(payload.preferredName ?? "CAC application");
  const amount = Number(order.amount ?? Number(intent.amount_kobo) / 100);
  const userId = String(order.user_id);
  const trackingReference = String(order.tracking_reference);
  const eventKey = `hub-payment:${reference}:paid`;
  const [{ notifyStaffNewHubOrder }, { notifyUser }, { sendHubLifecycleEmail }] = await Promise.all(
    [
      import("@/lib/hub-documents.functions"),
      import("@/lib/hub-notify.server"),
      import("@/lib/hub-email.server"),
    ],
  );

  const [staffNotice, customerNotice] = await Promise.all([
    notifyStaffNewHubOrder({
      service: "cac",
      amount,
      orderHint: preferredName,
      eventKey: `${eventKey}:staff`,
    }),
    notifyUser({
      userId,
      title: "CAC application received",
      message:
        delivery === "deliver"
          ? "We received your application. We’ll process it and deliver the printed pack to your address."
          : "We received your application. You’ll be notified when the certificate is ready to download.",
      type: "success",
      eventKey: `${eventKey}:customer:${userId}`,
    }),
  ]);

  if (!staffNotice.ok || !customerNotice.ok) {
    throw new Error(
      `Payment notification delivery failed: ${[
        !staffNotice.ok ? staffNotice.error : null,
        !customerNotice.ok ? customerNotice.error : null,
      ]
        .filter(Boolean)
        .join("; ")}`,
    );
  }

  // Email delivery is independent of in-app notifications; it must never
  // affect the already-committed payment or prevent its webhook acknowledgement.
  void sendHubLifecycleEmail({
    userId,
    event: "paid",
    service: "cac",
    trackingReference,
    amount,
  }).catch((error) => {
    console.warn("[paystack-webhook] paid email delivery failed", error);
  });

  console.info("[paystack-webhook] Hub payment intent finalized", {
    reference,
    service: intent.service,
    transactionId: providerTransactionId,
    wasExisting: Boolean(order.was_existing),
  });
  return true;
}

type PaystackWebhookEvent = {
  event?: string;
  data?: {
    reference?: string;
  };
};
