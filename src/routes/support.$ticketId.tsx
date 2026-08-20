import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { friendlyError, useApp } from "@/lib/app-store";
import { formatTicketStatus, statusBadgeClass, STATUS_LABEL } from "@/lib/care";
import { BRAND } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/support/$ticketId")({
  head: () => ({
    meta: [{ title: `RockPay Care — ${BRAND.name}` }],
  }),
  component: TicketThread,
});

type Ticket = {
  id: string;
  ticket_number: string | null;
  subject: string | null;
  status: string;
  description: string;
  user_id: string;
  created_at: string;
};

type Msg = {
  id: string;
  body: string;
  sender_id: string;
  is_internal: boolean;
  created_at: string;
};

function TicketThread() {
  const { ticketId } = Route.useParams();
  const { profile } = useApp();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const myIdRef = useRef<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      myIdRef.current = data.user?.id ?? null;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, m] = await Promise.all([
        supabase
          .from("support_tickets")
          .select("id, ticket_number, subject, status, description, user_id, created_at")
          .eq("id", ticketId)
          .maybeSingle(),
        supabase
          .from("support_messages")
          .select("id, body, sender_id, is_internal, created_at")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true }),
      ]);
      if (t.error) throw t.error;
      if (m.error) throw m.error;
      setTicket((t.data as Ticket) ?? null);
      setMessages((m.data as Msg[]) ?? []);
    } catch (e) {
      toast.error(friendlyError(e, "Could not load this request"));
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = body.trim();
    if (!text || !ticket) return;
    if (ticket.status === "closed") {
      toast.error("This request is closed");
      return;
    }
    setSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: ticketId,
        sender_id: user.id,
        body: text,
        is_internal: false,
      });
      if (error) throw error;
      setBody("");
      await load();
    } catch (e) {
      toast.error(friendlyError(e, "Could not send message"));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="RockPay Care" backTo="/support" />
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!ticket) {
    return (
      <AppShell>
        <PageHeader title="RockPay Care" backTo="/support" />
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Request not found.{" "}
          <Link to="/support" className="font-bold text-primary">
            Back to Care
          </Link>
        </p>
      </AppShell>
    );
  }

  const hint = STATUS_LABEL[ticket.status as keyof typeof STATUS_LABEL]?.hint;

  return (
    <AppShell>
      <PageHeader
        title={ticket.ticket_number ?? "RockPay Care"}
        {...(ticket.subject ? { subtitle: ticket.subject } : {})}
        backTo="/support"
      />
      <div className="flex min-h-[70dvh] flex-col px-4 pb-4">
        <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-border/70 bg-card px-3 py-2">
          <div className="min-w-0">
            <span
              className={cn(
                "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                statusBadgeClass(ticket.status),
              )}
            >
              {formatTicketStatus(ticket.status)}
            </span>
            {hint ? <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto pb-3">
          {messages.map((m) => {
            const mine = m.sender_id === myIdRef.current;
            return (
              <div
                key={m.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-xs",
                    mine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-border/70 bg-card",
                  )}
                >
                  <p className="text-[10px] font-bold opacity-80">
                    {mine ? profile.name.split(" ")[0] || "You" : "RockPay Care"}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[9px] opacity-70">
                    {new Date(m.created_at).toLocaleString("en-NG", {
                      day: "2-digit",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {ticket.status !== "closed" ? (
          <div className="sticky bottom-0 flex gap-2 border-t border-border/60 bg-background pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a message…"
              className="min-h-[44px] max-h-28 flex-1 resize-none rounded-xl text-sm"
              rows={2}
            />
            <Button
              size="icon"
              className="size-11 shrink-0 rounded-xl"
              disabled={sending || !body.trim()}
              onClick={() => void send()}
              aria-label="Send"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        ) : (
          <p className="py-2 text-center text-[11px] text-muted-foreground">This request is closed.</p>
        )}
      </div>
    </AppShell>
  );
}
