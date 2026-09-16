/**
 * Hub lifecycle emails via Resend.
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
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) {
      console.warn("[hub-email] getUserById", error.message);
      return null;
    }
    const email = data.user?.email?.trim();
    return email && email.includes("@") ? email : null;
  } catch (e) {
    console.warn("[hub-email] resolve email", e);
    return null;
  }
}

export type HubEmailEvent = "paid" | "digital_ready" | "dispatched" | "delivered";

export async function sendHubLifecycleEmail(input: {
  userId: string;
  event: HubEmailEvent;
  service: string;
  trackingReference?: string | null;
  amount?: number | null;
  trackingNote?: string | null;
  courierName?: string | null;
  appOrigin?: string;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!isResendConfigured()) {
    return { sent: false, skipped: true };
  }

  const to = await resolveUserEmail(input.userId);
  if (!to) return { sent: false, error: "No user email" };

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
        `Open the app → <strong>Profile → My documents</strong> to download.`,
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

  const result = await sendEmail({
    to,
    subject,
    html: layout(title, bodyHtml),
    text: lines
      .filter(Boolean)
      .map((l) => l.replace(/<[^>]+>/g, ""))
      .join("\n"),
  });

  if (!result.ok) return { sent: false, error: result.error };
  if (result.skipped) return { sent: false, skipped: true };
  return { sent: true };
}
