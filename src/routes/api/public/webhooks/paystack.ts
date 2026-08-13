import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Paystack webhook. Signature is validated over the raw body with the secret
 * key (HMAC SHA-512, Paystack's documented approach). Unsupported events are
 * ignored. Crediting goes through the same idempotent path as the callback,
 * so replayed events can never double-credit a wallet.
 */
export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";

        let secret: string;
        try {
          const { getPaystackSecret } = await import("@/lib/paystack.server");
          secret = getPaystackSecret();
        } catch {
          return new Response("Not configured", { status: 503 });
        }

        const expected = createHmac("sha512", secret).update(raw).digest("hex");
        const sig = Buffer.from(signature);
        const exp = Buffer.from(expected);
        if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: { event?: string; data?: { reference?: string } };
        try {
          event = JSON.parse(raw) as typeof event;
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const supported = ["charge.success", "charge.failed", "transfer.failed"];
        const reference = event.data?.reference;
        if (!event.event || !supported.includes(event.event) || !reference) {
          return new Response("ignored", { status: 200 });
        }

        try {
          // Re-verify with Paystack rather than trusting the payload body.
          const { verifyAndSettle } = await import("@/lib/paystack.server");
          await verifyAndSettle(reference);
        } catch (err) {
          console.error("paystack webhook settle failed", (err as Error).message);
          // 200 keeps Paystack from hammering us; the callback verify path and
          // the next event will settle it. Never credit on failure.
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
