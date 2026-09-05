import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { friendlyError } from "@/lib/app-store";
import { formatTicketStatus, statusBadgeClass, type TicketStatus } from "@/lib/care";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/care/$ticketId")({
  component: StaffTicket,
});

type Ticket = {
  id: string;
  ticket_number: string | null;
  subject: string | null;
  status: string;
  category: string;
  description: string;
  user_id: string;
  transaction_id: string | null;
  created_at: string;
};

type Msg = {
  id: string;
  body: string;
  sender_id: string;
  is_internal: boolean;
  created_at: string;
};

function StaffTicket() {
  const { ticketId } = Route.useParams();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [customer, setCustomer] = useState<{
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null>(null);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: t, error } = await supabase
        .from("support_tickets")
        .select(
          "id, ticket_number, subject, status, category, description, user_id, transaction_id, created_at",
        )
        .eq("id", ticketId)
        .maybeSingle();
      if (error) throw error;
      if (!t) {
        setTicket(null);
        return;
      }
      setTicket(t as Ticket);

      const [m, p] = await Promise.all([
        supabase
          .from("support_messages")
          .select("id, body, sender_id, is_internal, created_at")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", t.user_id)
          .maybeSingle(),
      ]);
      setMessages((m.data as Msg[]) ?? []);
      setCustomer(p.data ?? null);
    } catch (e) {
      toast.error(friendlyError(e, "Could not load ticket"));
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reply = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc("staff_care_reply", {
        _ticket_id: ticketId,
        _body: body.trim(),
        _internal: internal,
      });
      if (error) throw error;
      setBody("");
      setInternal(false);
      await load();
      toast.success(internal ? "Internal note saved" : "Reply sent");
    } catch (e) {
      toast.error(friendlyError(e, "Could not send"));
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: TicketStatus) => {
    try {
      const { error } = await supabase.rpc("staff_care_set_status", {
        _ticket_id: ticketId,
        _status: status,
      });
      if (error) throw error;
      await load();
      toast.success(`Status → ${formatTicketStatus(status)}`);
    } catch (e) {
      toast.error(friendlyError(e, "Could not update status"));
    }
  };

  if (loading) {
    return (
      <AdminShell title="Care ticket">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  if (!ticket) {
    return (
      <AdminShell title="Care ticket">
        <p className="text-sm text-muted-foreground">
          Ticket not found.{" "}
          <Link to="/admin/care" className="font-bold text-primary">
            Back to queue
          </Link>
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={ticket.ticket_number ?? "Ticket"}
      subtitle={ticket.subject ?? ticket.description}
      actions={
        <Link to="/admin/care" className="text-xs font-bold text-primary">
          Queue
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex min-h-[60vh] flex-col rounded-xl border border-border/70 bg-card">
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs",
                  m.is_internal
                    ? "border border-dashed border-warning/40 bg-warning-soft/40"
                    : "border border-border/60 bg-background",
                )}
              >
                <p className="text-[10px] font-bold text-muted-foreground">
                  {m.is_internal ? "Internal note" : "Message"} ·{" "}
                  {new Date(m.created_at).toLocaleString("en-NG", {
                    day: "2-digit",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-border/60 p-3 space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={internal ? "Internal note (customer cannot see)" : "Reply to customer…"}
              className="min-h-[64px] rounded-xl text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />
                Internal note
              </label>
              <Button
                size="sm"
                className="ml-auto h-9 rounded-xl font-bold"
                disabled={sending || !body.trim()}
                onClick={() => void reply()}
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {internal ? "Save note" : "Send reply"}
              </Button>
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-card p-3">
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
              Status
            </p>
            <span
              className={cn(
                "mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold",
                statusBadgeClass(ticket.status),
              )}
            >
              {formatTicketStatus(ticket.status)}
            </span>
            <div className="mt-2 flex flex-wrap gap-1">
              {(["open", "in_progress", "waiting_for_customer", "resolved", "closed"] as const).map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void setStatus(s)}
                    className="h-7 rounded-lg border border-border/70 px-2 text-[10px] font-bold"
                  >
                    {formatTicketStatus(s)}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-3">
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
              Customer
            </p>
            <p className="mt-1 text-sm font-bold">{customer?.full_name || "—"}</p>
            <p className="text-xs text-muted-foreground">{customer?.email || "—"}</p>
            <p className="text-xs text-muted-foreground">{customer?.phone || "—"}</p>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-3">
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
              Ticket
            </p>
            <p className="mt-1 text-xs font-mono">{ticket.ticket_number}</p>
            <p className="text-xs text-muted-foreground">{ticket.category}</p>
            {ticket.transaction_id ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Tx linked: {ticket.transaction_id.slice(0, 8)}…
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}
