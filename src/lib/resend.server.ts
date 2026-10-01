/**
 * Resend mail transport (server only).
 * If RESEND_API_KEY is missing, send is a no-op (in-app notifications still work).
 *
 * Env:
 *   RESEND_API_KEY=re_...
 *   RESEND_FROM=RockPay <orders@yourdomain.com>   // must be a verified domain/sender in Resend
 *   RESEND_REPLY_TO=support@yourdomain.com        // optional
 */

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailResult =
  { ok: true; id?: string; skipped?: boolean } | { ok: false; error: string };

function env(key: string): string {
  try {
    return String(process.env[key] ?? "").trim();
  } catch {
    return "";
  }
}

export function isResendConfigured(): boolean {
  return Boolean(env("RESEND_API_KEY") && env("RESEND_FROM"));
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = env("RESEND_API_KEY");
  const from = env("RESEND_FROM");
  const replyTo = env("RESEND_REPLY_TO");

  if (!apiKey || !from) {
    console.info("[resend] skipped — set RESEND_API_KEY and RESEND_FROM");
    return { ok: true, skipped: true };
  }

  const to = Array.isArray(input.to) ? input.to : [input.to];
  const cleaned = to.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));
  if (!cleaned.length) {
    return { ok: false, error: "No valid recipient email" };
  }

  try {
    const body: Record<string, unknown> = {
      from,
      to: cleaned,
      subject: input.subject,
      html: input.html,
    };
    if (input.text) body.text = input.text;
    if (replyTo) body.reply_to = replyTo;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      const msg = json.message || `Resend HTTP ${res.status}`;
      console.warn("[resend] fail", msg);
      return { ok: false, error: msg };
    }
    return { ok: true, id: json.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Resend request failed";
    console.warn("[resend] error", msg);
    return { ok: false, error: msg };
  }
}
