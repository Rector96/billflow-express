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
            // Hub orders are handled by authenticated server functions. We do
            // not infer the customer or order amount from checkout metadata.
            console.info(
              "[paystack-webhook] no wallet funding row; hub order requires authenticated server verification",
              reference,
            );
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

type PaystackWebhookEvent = {
  event?: string;
  data?: {
    reference?: string;
  };
};
