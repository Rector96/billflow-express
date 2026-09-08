import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminEmpty, AdminLoading, AdminShell, KpiCard } from "@/components/admin/admin-shell";
import { formatTicketStatus, statusBadgeClass } from "@/lib/care";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/care")({
  validateSearch: (s: Record<string, unknown>) => ({
    ...(typeof s["q"] === "string" ? { q: s["q"] as string } : {}),
  }),
  component: CareLayout,
});

function CareLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/admin/care") return <Outlet />;
  return <CareQueue />;
}

type Ticket = {
  id: string;
  ticket_number: string | null;
  subject: string | null;
  status: string;
  category: string;
  description: string;
  created_at: string;
  user_id: string;
  user_label: string;
  user_email: string;
  total_count: number;
};

type Stats = { open: number; investigating: number; waiting: number; resolved_today: number };

const PAGE = 50;

function CareQueue() {
  const search = Route.useSearch();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState(search.q ?? "");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const knownTicketIds = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        supabase.rpc("admin_care_stats"),
        supabase.rpc("admin_care_queue", {
          _query: q.trim(),
          _status: status,
          _limit: PAGE,
          _offset: page * PAGE,
        }),
      ]);
      if (s.error) throw s.error;
      if (t.error) throw t.error;
      if (s.data) setStats(s.data as Stats);
      const rows = (t.data as Ticket[]) ?? [];
      const previous = knownTicketIds.current;
      if (previous) {
        const newCount = rows.filter((row) => !previous.has(row.id)).length;
        if (newCount > 0) toast.info(`${newCount} new Care request${newCount === 1 ? "" : "s"}`);
      }
      knownTicketIds.current = new Set(rows.map((row) => row.id));
      setTickets(rows);
      setTotal(Number(rows[0]?.total_count ?? 0));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load Care queue");
      setTickets([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, q, status]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    setQ(search.q ?? "");
    setPage(0);
  }, [search.q]);

  return (
    <AdminShell title="RockPay Care" subtitle={`${total} support tickets`}>
      {loading && !stats ? (
        <AdminLoading label="Loading Care…" />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <KpiCard label="Open" value={String(stats?.open ?? 0)} />
            <KpiCard label="Investigating" value={String(stats?.investigating ?? 0)} />
            <KpiCard label="Waiting" value={String(stats?.waiting ?? 0)} />
            <KpiCard label="Resolved today" value={String(stats?.resolved_today ?? 0)} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Search ticket, customer, transaction…"
              className="h-9 flex-1 rounded-xl border border-border/70 bg-card px-3 text-sm min-w-[12rem]"
            />
            {["all", "open", "in_progress", "waiting_for_customer", "resolved", "closed"].map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStatus(s);
                    setPage(0);
                  }}
                  className={cn(
                    "h-8 rounded-full border px-2.5 text-[11px] font-bold",
                    status === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/70 bg-card text-muted-foreground",
                  )}
                >
                  {s === "all" ? "All" : formatTicketStatus(s)}
                </button>
              ),
            )}
          </div>

          {tickets.length === 0 ? (
            <AdminEmpty
              title="No tickets"
              body="When customers open RockPay Care, requests appear here."
            />
          ) : (
            <div className="space-y-1.5">
              {tickets.map((t) => (
                <Link
                  key={t.id}
                  to="/admin/care/$ticketId"
                  params={{ ticketId: t.id }}
                  className="press flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {t.ticket_number ?? t.id.slice(0, 8)} · {t.subject ?? t.description}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {t.user_label || t.user_email || "Customer"} ·{" "}
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
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      statusBadgeClass(t.status),
                    )}
                  >
                    {formatTicketStatus(t.status)}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} · {PAGE} / page
            </span>
            <button
              type="button"
              disabled={(page + 1) * PAGE >= total || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
