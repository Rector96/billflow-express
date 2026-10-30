/**
 * Idempotent in-app notifications for Hub order lifecycle.
 * Email is handled separately via hub-email.server (Resend).
 */
type NotifType = "success" | "warning" | "information" | "pending" | "security";

type NotificationResult = { ok: true } | { ok: false; error: string };

export async function notifyUser(input: {
  userId: string;
  title: string;
  message: string;
  type?: NotifType;
  eventKey?: string;
}): Promise<NotificationResult> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      user_id: input.userId,
      title: input.title,
      message: input.message,
      type: input.type ?? "information",
      read: false,
      ...(input.eventKey ? { notification_key: input.eventKey } : {}),
    };
    const { error } = input.eventKey
      ? await supabaseAdmin.from("notifications").upsert(row as never, {
          onConflict: "notification_key",
          ignoreDuplicates: true,
        })
      : await supabaseAdmin.from("notifications").insert(row as never);
    if (error) {
      console.warn("[hub-notify] user", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Notification insert failed";
    console.warn("[hub-notify] user failed", message);
    return { ok: false, error: message };
  }
}

/** Notify all staff role holders (admin / super_admin / support). */
export async function notifyStaff(input: {
  title: string;
  message: string;
  type?: NotifType;
  eventKey?: string;
}): Promise<NotificationResult> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "super_admin", "support"]);
    if (error) {
      console.warn("[hub-notify] staff roles", error.message);
      return { ok: false, error: error.message };
    }
    const ids = [...new Set((roles ?? []).map((r) => String((r as { user_id: string }).user_id)))];
    if (!ids.length) return { ok: true };
    const rows = ids.map((user_id) => ({
      user_id,
      title: input.title,
      message: input.message,
      type: input.type ?? "information",
      read: false,
      ...(input.eventKey ? { notification_key: `${input.eventKey}:${user_id}` } : {}),
    }));
    const { error: insErr } = input.eventKey
      ? await supabaseAdmin.from("notifications").upsert(rows as never, {
          onConflict: "notification_key",
          ignoreDuplicates: true,
        })
      : await supabaseAdmin.from("notifications").insert(rows as never);
    if (insErr) {
      console.warn("[hub-notify] staff insert", insErr.message);
      return { ok: false, error: insErr.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Staff notification insert failed";
    console.warn("[hub-notify] staff failed", message);
    return { ok: false, error: message };
  }
}

export function customerCopyForStatus(
  service: string,
  status: string,
): { title: string; message: string; type: NotifType } {
  const s = service.replace(/_/g, " ");
  if (status === "in_progress") {
    return {
      title: `${s} — in progress`,
      message: "Our team is working on your application. We’ll notify you again when it’s ready.",
      type: "information",
    };
  }
  if (status === "successful") {
    return {
      title: `${s} — ready`,
      message: "Your document is ready. Open Profile → My documents to download.",
      type: "success",
    };
  }
  if (status === "failed") {
    return {
      title: `${s} — needs attention`,
      message:
        "We couldn’t complete this request. Open Support or check notifications for details.",
      type: "warning",
    };
  }
  return {
    title: `${s} updated`,
    message: `Status is now ${status.replace(/_/g, " ")}.`,
    type: "information",
  };
}
