import { createFileRoute } from "@tanstack/react-router";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Paystack webhook — production path used by RockPay on Netlify.
 *
 * URL (register in Paystack Dashboard → Settings → API Keys & Webhooks):
 *   https://<your-domain>/api/public/webhooks/paystack
 *
 * Security:
 *   - HMAC SHA-512 over the *raw* body vs `x-paystack-signature`
 *   - timing-safe compare
 *   - wallet funding still goes through idempotent verifyAndSettle
 *   - hub services also land in public.hub_orders (idempotent on payment_reference)
 *
 * Note: This is TanStack Start (not Next.js). Do not use
 * `src/app/api/.../route.ts` — that path does not exist in this repo.
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

        const expected = createHmac("sha512", secret).update(raw).digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
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

        // 1) Wallet funding path (existing, idempotent)
        try {
          const { verifyAndSettle } = await import("@/lib/paystack.server");
          await verifyAndSettle(reference);
          console.info("[paystack-webhook] wallet settle ok", reference);
        } catch (err) {
          // Unknown funding reference is normal for pure hub payments — do not 503.
          const msg = (err as Error).message ?? "";
          if (msg.includes("Unknown funding reference")) {
            console.info("[paystack-webhook] no wallet funding row — checking hub", reference);
          } else {
            console.error("[paystack-webhook] wallet settle failed", msg);
            // Transient DB/API errors: ask Paystack to retry
            return new Response("Retry settlement", { status: 503 });
          }
        }

        // 2) Hub services (TIN / vehicle / CAC / documents / NIN)
        if (eventName === "charge.success" && event.data) {
          try {
            await recordHubOrderFromCharge(event.data);
          } catch (err) {
            console.error("[paystack-webhook] hub_orders failed", (err as Error).message);
            // Do not fail the whole webhook if hub insert fails after wallet settled;
            // log and return 200 so Paystack does not hammer wallet path.
            // Operators can reconcile from logs + Paystack dashboard.
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

type PaystackWebhookEvent = {
  event?: string;
  data?: PaystackChargeData;
};

type PaystackChargeData = {
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  customer?: { email?: string; customer_code?: string };
  metadata?: Record<string, unknown> | null;
};

function trackingSlug(service: string): string {
  const prefix =
    service.includes("vehicle") || service.includes("veh")
      ? "RPK-VEH"
      : service.includes("tin")
        ? "RPK-TIN"
        : service.includes("cac")
          ? "RPK-CAC"
          : service.includes("nin")
            ? "RPK-NIN"
            : service.includes("doc")
              ? "RPK-DOC"
              : "RPK-HUB";
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function readMeta(meta: Record<string, unknown> | null | undefined, key: string): string {
  if (!meta) return "";
  const direct = meta[key];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (typeof direct === "number") return String(direct);

  // Paystack custom_fields: [{ variable_name, value }]
  const fields = meta["custom_fields"];
  if (Array.isArray(fields)) {
    for (const f of fields) {
      if (!f || typeof f !== "object") continue;
      const row = f as Record<string, unknown>;
      const name = String(row["variable_name"] ?? row["display_name"] ?? "");
      if (name === key && row["value"] != null) return String(row["value"]).trim();
    }
  }
  return "";
}

async function recordHubOrderFromCharge(data: PaystackChargeData) {
  const reference = String(data.reference ?? "").trim();
  if (!reference) return;

  const meta = (data.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Record<
    string,
    unknown
  >;

  const service =
    readMeta(meta, "service_type") || readMeta(meta, "service") || readMeta(meta, "channel") || "";

  // Only treat as hub if metadata looks like a hub product (not pure wallet fund)
  const isHub =
    Boolean(service) &&
    service !== "wallet" &&
    service !== "funding" &&
    (service.includes("vehicle") ||
      service.includes("tin") ||
      service.includes("cac") ||
      service.includes("nin") ||
      service.includes("doc") ||
      service.includes("hub") ||
      service.includes("license") ||
      service.includes("insurance") ||
      meta["channel"] === "hub" ||
      readMeta(meta, "channel") === "hub");

  if (!isHub) {
    console.info("[paystack-webhook] not a hub charge — skip hub_orders", reference);
    return;
  }

  const amountKobo = Number(data.amount ?? 0);
  const amountNaira = Math.round((Number.isFinite(amountKobo) ? amountKobo : 0) / 100);
  const email = String(data.customer?.email ?? "")
    .trim()
    .toLowerCase();
  const plate =
    readMeta(meta, "plate_number") || readMeta(meta, "plate") || readMeta(meta, "identifier");
  const userIdMeta = readMeta(meta, "user_id");

  console.info("[paystack-webhook] hub charge", {
    reference,
    service,
    amountNaira,
    email: email ? `${email.slice(0, 3)}…` : null,
    plate: plate || null,
  });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Idempotent: unique payment_reference
  const { data: existing } = await supabaseAdmin
    .from("hub_orders")
    .select("id, payment_reference")
    .eq("payment_reference", reference)
    .limit(1);
  if (existing?.[0]) {
    console.info("[paystack-webhook] hub_orders already exists", reference);
    return;
  }

  let userId = userIdMeta || "";
  if (!userId && email) {
    try {
      const { data: users } = await supabaseAdmin
        .from("profiles")
        .select("user_id, id, email")
        .ilike("email", email)
        .limit(1);
      const row = users?.[0] as { user_id?: string; id?: string } | undefined;
      userId = String(row?.user_id ?? row?.id ?? "");
    } catch (e) {
      console.warn("[paystack-webhook] profile lookup", (e as Error).message);
    }
  }

  if (!userId) {
    // Cannot satisfy NOT NULL user_id — log for ops; frontend recordHubPayment may still insert.
    console.warn("[paystack-webhook] no user_id for hub order", reference, email);
    return;
  }

  const tracking = trackingSlug(service);
  const { error } = await supabaseAdmin.from("hub_orders").insert({
    user_id: userId,
    service,
    amount: amountNaira,
    status: "successful",
    payment_reference: reference,
    tracking_reference: tracking,
    customer_identifier: plate || email || null,
    metadata: {
      channel: "hub",
      source: "paystack_webhook",
      customer_email: email || null,
      paystack_currency: data.currency ?? "NGN",
      ...meta,
    },
  } as never);

  if (error) {
    // Unique violation = concurrent insert; treat as success
    if (String(error.message).toLowerCase().includes("duplicate") || error.code === "23505") {
      console.info("[paystack-webhook] hub_orders race won by peer", reference);
      return;
    }
    throw new Error(error.message);
  }

  console.info("[paystack-webhook] hub_orders inserted", {
    reference,
    tracking,
    service,
    amountNaira,
  });
}
