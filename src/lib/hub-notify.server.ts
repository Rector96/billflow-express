/**
 * Insert in-app notifications for hub order lifecycle.
 * Uses public.notifications (user_id, title, message, type, read).
 */
type NotifType = "success" | "warning" | "information" | "pending" | "security";

export async function notifyUser(input: {
  userId: string;
  title: string;
  message: string;
  type?: NotifType;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: input.userId,
      title: input.title,
      message: input.message,
      type: input.type ?? "information",
      read: false,
    } as never);
    if (error) console.warn("[hub-notify] user", error.message);
  } catch (e) {
    console.warn("[hub-notify] user failed", e);
  }
}

/** Notify all staff role holders (admin / super_admin / support). */
export async function notifyStaff(input: { title: string; message: string; type?: NotifType }) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "super_admin", "support"]);
    if (error) {
      console.warn("[hub-notify] staff roles", error.message);
      return;
    }
    const ids = [...new Set((roles ?? []).map((r) => String((r as { user_id: string }).user_id)))];
    if (!ids.length) return;
    const rows = ids.map((user_id) => ({
      user_id,
      title: input.title,
      message: input.message,
      type: input.type ?? "information",
      read: false,
    }));
    const { error: insErr } = await supabaseAdmin.from("notifications").insert(rows as never);
    if (insErr) console.warn("[hub-notify] staff insert", insErr.message);
  } catch (e) {
    console.warn("[hub-notify] staff failed", e);
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
