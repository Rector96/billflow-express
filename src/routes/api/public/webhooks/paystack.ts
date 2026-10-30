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
  if (String(transaction.status ?? "").toLowerCase() !== "success") {
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

  const { error: finalizeError } = await admin.rpc("finalize_hub_payment_intent", {
    _payment_reference: reference,
    _provider_transaction_id: providerTransactionId,
    _paid_at: transaction.paid_at ?? transaction.paidAt ?? new Date().toISOString(),
  });
  if (finalizeError) throw new Error(`Hub payment finalization failed: ${finalizeError.message}`);

  console.info("[paystack-webhook] Hub payment intent finalized", {
    reference,
    service: intent.service,
    transactionId: providerTransactionId,
  });
  return true;
}

type PaystackWebhookEvent = {
  event?: string;
  data?: {
    reference?: string;
  };
};
