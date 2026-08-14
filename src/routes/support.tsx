import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, HeartHandshake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { friendlyError, useApp } from "@/lib/app-store";
import {
  CATEGORY_OPTIONS,
  TX_ISSUE_OPTIONS,
  formatTicketStatus,
  statusBadgeClass,
  type TicketCategory,
} from "@/lib/care";
import { formatNaira } from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Search = { reference?: string | undefined };

export const Route = createFileRoute("/support")({
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s["reference"] === "string" ? { reference: s["reference"] } : {},
  head: () => ({
    meta: [
      { title: `RockPay Care — ${BRAND.name}` },
      { name: "description", content: "Get help with payments, wallet and account." },
      { property: "og:title", content: `RockPay Care — ${BRAND.name}` },
    ],
  }),
  component: SupportLayout,
});

function SupportLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/support") return <Outlet />;
  return <CareHub />;
}

type TicketRow = {
  id: string;
  ticket_number: string | null;
  subject: string | null;
  status: string;
  category: string;
  description: string;
  created_at: string;
  transaction_id: string | null;
};

function CareHub() {
  const navigate = useNavigate();
  const { reference } = Route.useSearch();
  const { transactions, authed } = useApp();
  const tx = useMemo(
    () => (reference ? transactions.find((t) => t.id === reference) : undefined),
    [reference, transactions],
  );

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [step, setStep] = useState<"home" | "compose">("home");
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, status, category, description, created_at, transaction_id")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      setTickets((data as TicketRow[]) ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (authed) void loadTickets();
  }, [authed, loadTickets]);

  useEffect(() => {
    if (reference) setStep("compose");
  }, [reference]);

  const startGeneral = (cat: TicketCategory) => {
    setCategory(cat);
    setReason(null);
    setNote("");
    setStep("compose");
  };

  const startTxIssue = (opt: (typeof TX_ISSUE_OPTIONS)[number]) => {
    setCategory(opt.category);
    setReason(opt.reason);
    setNote("");
    setStep("compose");
  };

  const submit = async () => {
    if (!category) {
      toast.error("Choose a topic");
      return;
    }
    setSubmitting(true);
    try {
      const desc =
        note.trim() ||
        (reason
          ? TX_ISSUE_OPTIONS.find((o) => o.reason === reason)?.label ?? reason
          : CATEGORY_OPTIONS.find((c) => c.key === category)?.label ?? "Support request");

      const { data, error } = await supabase.rpc("create_care_ticket", {
        _category: category,
        _description: desc,
        _subject: desc.slice(0, 80),
        _reason: reason ?? null,
        _transaction_id: null,
        _reference: reference ?? null,
      });
      if (error) throw error;
      const row = data as { id: string; ticket_number: string; duplicate?: boolean };
      if (row.duplicate) {
        toast.message("You already have an active request for this payment");
      } else {
        toast.success(`Request ${row.ticket_number} opened`);
      }
      void navigate({ to: "/support/$ticketId", params: { ticketId: row.id } });
    } catch (e) {
      toast.error(friendlyError(e, "Could not open RockPay Care request"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="RockPay Care" backTo="/home" />
      <div className="space-y-4 px-4 pt-1 pb-6">
        {step === "home" ? (
          <>
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
                <HeartHandshake className="size-4" />
              </span>
              <div>
                <p className="text-sm font-extrabold">How can we help?</p>
                <p className="text-[11px] text-muted-foreground">
                  We use what RockPay already knows — you only add what's missing.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                Topics
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {CATEGORY_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => startGeneral(c.key)}
                    className="press rounded-xl border border-border/70 bg-card px-3 py-2.5 text-left text-xs font-bold"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <section>
              <p className="mb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                My requests
              </p>
              {loadingList ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Loading…</p>
              ) : tickets.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 py-6 text-center text-xs text-muted-foreground">
                  No support requests yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {tickets.map((t) => (
                    <Link
                      key={t.id}
                      to="/support/$ticketId"
                      params={{ ticketId: t.id }}
                      className="press flex items-center gap-2 rounded-xl border border-border/70 bg-card px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">
                          {t.ticket_number ?? "RockPay Care"} · {t.subject ?? t.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(t.created_at).toLocaleString("en-NG", {
                            day: "2-digit",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          statusBadgeClass(t.status),
                        )}
                      >
                        {formatTicketStatus(t.status)}
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <button
              type="button"
              className="text-[11px] font-bold text-primary"
              onClick={() => {
                setStep("home");
                setCategory(null);
                setReason(null);
              }}
            >
              ← Back
            </button>

            {reference || tx ? (
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                  Let's help with this payment
                </p>
                {tx ? (
                  <div className="mt-1.5 space-y-0.5 text-xs">
                    <p className="font-bold">{tx.title}</p>
                    <p className="text-muted-foreground">{tx.service}</p>
                    <p className="font-extrabold tabular-nums">{formatNaira(tx.amount, false)}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{tx.id}</p>
                    <p className="capitalize text-muted-foreground">Status: {tx.status}</p>
                  </div>
                ) : (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{reference}</p>
                )}
              </div>
            ) : null}

            {reference ? (
              <div>
                <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">What happened?</p>
                <div className="space-y-1.5">
                  {TX_ISSUE_OPTIONS.map((o) => (
                    <button
                      key={o.reason}
                      type="button"
                      onClick={() => startTxIssue(o)}
                      className={cn(
                        "press w-full rounded-xl border px-3 py-2.5 text-left text-xs font-bold",
                        reason === o.reason
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border/70 bg-card",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Topic:{" "}
                <span className="font-bold text-foreground">
                  {CATEGORY_OPTIONS.find((c) => c.key === category)?.label}
                </span>
              </p>
            )}

            <div>
              <p className="mb-1 text-[11px] font-bold text-muted-foreground">
                Anything else? <span className="font-normal">(optional)</span>
              </p>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a short note if needed"
                className="min-h-[72px] rounded-xl text-sm"
              />
            </div>

            <Button
              className="h-11 w-full rounded-xl font-bold"
              disabled={submitting || (!category && !reason)}
              onClick={() => void submit()}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Open RockPay Care request
            </Button>
          </>
        )}
      </div>
    </AppShell>
  );
}
