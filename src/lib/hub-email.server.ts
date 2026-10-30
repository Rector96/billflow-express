/**
 * Durable Hub lifecycle email outbox with Resend delivery.
 * Events: paid | digital_ready | dispatched | delivered
 */
import { sendEmail, isResendConfigured } from "@/lib/resend.server";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e5e7eb;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.06em;color:#0d9488;text-transform:uppercase;">RockPay</p>
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f172a;">${escapeHtml(title)}</h1>
          ${bodyHtml}
          <p style="margin:24px 0 0;font-size:12px;color:#64748b;line-height:1.5;">Questions? Reply to this email or open RockPay → Support.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function resolveUserEmail(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) {
    console.warn("[hub-email] getUserById", error.message);
    return null;
  }
  const email = data.user?.email?.trim();
  return email && email.includes("@") ? email : null;
}

export type HubEmailEvent = "paid" | "digital_ready" | "dispatched" | "delivered";

export type HubLifecycleEmailInput = {
  userId: string;
  event: HubEmailEvent;
  eventKey: string;
  service: string;
  trackingReference?: string | null;
  amount?: number | null;
  trackingNote?: string | null;
  courierName?: string | null;
  appOrigin?: string;
};

type EmailPayload = Omit<HubLifecycleEmailInput, "userId" | "event" | "eventKey">;

function buildEmail(input: HubLifecycleEmailInput, to: string) {
  const service = input.service.replace(/_/g, " ");
  const ref = input.trackingReference || "—";
  const amount =
    input.amount != null && Number.isFinite(Number(input.amount))
      ? `₦${Math.round(Number(input.amount)).toLocaleString("en-NG")}`
      : null;
  const origin = (input.appOrigin || "").replace(/\/$/, "");
  const docsLink = origin ? `${origin}/profile` : "Profile → My documents";

  let subject = "";
  let title = "";
  let lines: string[] = [];
  switch (input.event) {
    case "paid":
      subject = `Payment received · ${service}`;
      title = "Payment received";
      lines = [
        `We received your payment for <strong>${escapeHtml(service)}</strong>.`,
        amount ? `Amount: <strong>${escapeHtml(amount)}</strong>` : "",
        `Reference: <strong>${escapeHtml(ref)}</strong>`,
        "Our team will process your order. You’ll get another email when it’s ready.",
      ];
      break;
    case "digital_ready":
      subject = `Ready to download · ${service}`;
      title = "Your document is ready";
      lines = [
        `Your <strong>${escapeHtml(service)}</strong> file is ready.`,
        "Open the app → <strong>Profile → My documents</strong> to download.",
        origin
          ? `Or sign in: <a href="${escapeHtml(origin)}/profile">${escapeHtml(docsLink)}</a>`
          : "",
        `Reference: <strong>${escapeHtml(ref)}</strong>`,
      ];
      break;
    case "dispatched":
      subject = `On the way · ${service}`;
      title = "Your package is on the way";
      lines = [
        `Your physical pack for <strong>${escapeHtml(service)}</strong> has been handed to a rider.`,
        input.courierName ? `Rider: <strong>${escapeHtml(input.courierName)}</strong>` : "",
        input.trackingNote ? `Tracking: <strong>${escapeHtml(input.trackingNote)}</strong>` : "",
        `Reference: <strong>${escapeHtml(ref)}</strong>`,
      ];
      break;
    case "delivered":
      subject = `Delivered · ${service}`;
      title = "Package marked delivered";
      lines = [
        `Your <strong>${escapeHtml(service)}</strong> package was marked delivered.`,
        `Reference: <strong>${escapeHtml(ref)}</strong>`,
        "If anything is missing, open RockPay Support.",
      ];
      break;
  }
  const bodyHtml = lines
    .filter(Boolean)
    .map(
      (p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;">${p}</p>`,
    )
    .join("");
  return {
    to,
    subject,
    html: layout(title, bodyHtml),
    text: lines
      .filter(Boolean)
      .map((line) => line.replace(/<[^>]+>/g, ""))
      .join("\n"),
    idempotencyKey: input.eventKey,
  };
}

/** Enqueue first, then make a best-effort immediate delivery attempt. */
export async function sendHubLifecycleEmail(
  input: HubLifecycleEmailInput,
): Promise<{ queued: boolean; sent?: boolean; error?: string }> {
  const eventKey = String(input.eventKey ?? "").trim();
  if (!eventKey) return { queued: false, error: "A stable email event key is required" };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: EmailPayload = {
      service: input.service,
      trackingReference: input.trackingReference ?? null,
      amount: input.amount ?? null,
      trackingNote: input.trackingNote ?? null,
      courierName: input.courierName ?? null,
      appOrigin: input.appOrigin,
    };
    const { error } = await supabaseAdmin.from("hub_email_outbox").upsert(
      {
        event_key: eventKey,
        user_id: input.userId,
        event: input.event,
        payload,
        status: "pending",
        next_attempt_at: new Date().toISOString(),
      } as never,
      { onConflict: "event_key", ignoreDuplicates: true },
    );
    if (error) {
      console.warn("[hub-email] enqueue failed", error.message);
      return { queued: false, error: error.message };
    }

    if (!isResendConfigured()) return { queued: true };
    const delivery = await processHubEmailOutbox(5);
    return { queued: true, sent: delivery.sent > 0, error: delivery.errors[0] };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Email enqueue failed";
    console.warn("[hub-email] enqueue exception", message);
    return { queued: false, error: message };
  }
}

/** Service-role worker. Safe for concurrent callers through SKIP LOCKED claims. */
export async function processHubEmailOutbox(
  batchSize = 10,
): Promise<{ claimed: number; sent: number; failed: number; errors: string[] }> {
  if (!isResendConfigured()) return { claimed: 0, sent: 0, failed: 0, errors: [] };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: jobs, error: claimError } = await supabaseAdmin.rpc("claim_hub_email_outbox", {
    _batch_size: Math.min(Math.max(Math.trunc(batchSize), 1), 100),
  });
  if (claimError) {
    console.warn("[hub-email] claim failed", claimError.message);
    return { claimed: 0, sent: 0, failed: 0, errors: [claimError.message] };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const raw of jobs ?? []) {
    const job = raw as {
      id: string;
      event_key: string;
      user_id: string;
      event: HubEmailEvent;
      payload: EmailPayload;
      attempts: number;
    };
    try {
      const to = await resolveUserEmail(job.user_id);
      if (!to) throw new Error("No valid email address for customer");
      const input = {
        userId: job.user_id,
        event: job.event,
        eventKey: job.event_key,
        ...job.payload,
      } as HubLifecycleEmailInput;
      const result = await sendEmail(buildEmail(input, to));
      if (!result.ok || result.skipped) {
        throw new Error(result.ok ? "Resend is not configured" : result.error);
      }
      const { error: updateError } = await supabaseAdmin
        .from("hub_email_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: result.id ?? null,
          locked_at: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", job.id);
      if (updateError) throw new Error(updateError.message);
      sent++;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Email delivery failed";
      const terminal = job.attempts >= 5;
      const delayMinutes = Math.min(360, 2 ** Math.min(job.attempts, 8));
      const { error: updateError } = await supabaseAdmin
        .from("hub_email_outbox")
        .update({
          status: terminal ? "failed" : "pending",
          next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
          locked_at: null,
          last_error: message.slice(0, 1000),
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", job.id);
      if (updateError) errors.push(updateError.message);
      errors.push(message);
      failed++;
    }
  }
  return { claimed: (jobs ?? []).length, sent, failed, errors };
}
