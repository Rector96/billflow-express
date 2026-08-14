import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
};

type Stats = { open: number; investigating: number; waiting: number; resolved_today: number };

function CareQueue() {
  const search = Route.useSearch();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState(search.q ?? "");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        supabase.rpc("admin_care_stats"),
        supabase
          .from("support_tickets")
          .select("id, ticket_number, subject, status, category, description, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (s.data) setStats(s.data as Stats);
      const rows = (t.data as Ticket[]) ?? [];
      setTickets(rows);
      const ids = [...new Set(rows.map((r) => r.user_id))];
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", ids);
        const map: Record<string, { full_name: string | null; email: string | null }> = {};
        for (const p of ps ?? []) {
          map[p.user_id as string] = { full_name: p.full_name, email: p.email };
        }
        setProfiles(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tickets.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (!needle) return true;
      const p = profiles[t.user_id];
      const hay = `${t.ticket_number} ${t.subject} ${t.description} ${p?.full_name ?? ""} ${p?.email ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [tickets, status, q, profiles]);

  return (
    <AdminShell title="RockPay Care" subtitle="Support queue">
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
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ticket, name, email…"
              className="h-9 flex-1 rounded-xl border border-border/70 bg-card px-3 text-sm min-w-[12rem]"
            />
            {(["all", "open", "in_progress", "waiting_for_customer", "resolved", "closed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "h-8 rounded-full border px-2.5 text-[11px] font-bold",
                  status === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-card text-muted-foreground",
                )}
              >
                {s === "all" ? "All" : formatTicketStatus(s)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <AdminEmpty title="No tickets" body="When customers open RockPay Care, requests appear here." />
          ) : (
            <div className="space-y-1.5">
              {filtered.map((t) => {
                const p = profiles[t.user_id];
                return (
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
                        {p?.full_name || p?.email || "Customer"} ·{" "}
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
                );
              })}
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
