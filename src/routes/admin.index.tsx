import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell, KpiCard } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/app/ui-bits";
import { formatNaira, type TxStatus } from "@/lib/mock-data";
import { n, pctChange, type OpsStats, type ServiceRow, type VolumePoint } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: `Dashboard — ${BRAND.name} Admin` }],
  }),
  component: AdminDashboard,
});

type FeedItem = {
  id: string;
  title: string;
  amount: number;
  status: TxStatus;
  reference: string;
  created_at: string;
  user_label: string;
};

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<OpsStats>({});
  const [series, setSeries] = useState<VolumePoint[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ops, vol, svc, tx, profiles] = await Promise.all([
        supabase.rpc("admin_ops_stats"),
        supabase.rpc("admin_tx_volume_series", { _days: days }),
        supabase.rpc("admin_service_breakdown"),
        supabase
          .from("wallet_transactions")
          .select("id, reference, type, amount, status, description, provider, provider_reference, created_at, user_id, metadata")
          .order("created_at", { ascending: false })
          .limit(25),
        supabase.from("profiles").select("user_id, full_name, email").limit(500),
      ]);

      if (ops.error) {
        // Fallback if migration not applied yet
        const legacy = await supabase.rpc("admin_dashboard_stats");
        if (legacy.data && typeof legacy.data === "object") {
          setStats(legacy.data as OpsStats);
        } else {
          setError(ops.error.message);
        }
      } else if (ops.data && typeof ops.data === "object") {
        setStats(ops.data as OpsStats);
      }

      if (Array.isArray(vol.data)) setSeries(vol.data as VolumePoint[]);
      else setSeries([]);

      if (Array.isArray(svc.data)) setServices(svc.data as ServiceRow[]);
      else setServices([]);

      const pmap = new Map<string, { full_name: string | null; email: string | null }>();
      for (const p of profiles.data ?? []) pmap.set(p.user_id, p);

      setFeed(
        (tx.data ?? []).map((t) => {
          const meta = (t.metadata ?? {}) as Record<string, unknown>;
          const p = pmap.get(t.user_id);
          const title =
            typeof meta["title"] === "string"
              ? meta["title"]
              : t.description ?? (t.type === "deposit" ? "Wallet funded" : t.type);
          const status: TxStatus =
            t.status === "successful" || t.status === "pending" || t.status === "failed"
              ? t.status
              : "pending";
          return {
            id: t.id,
            title: String(title),
            amount: n(t.amount),
            status,
            reference: t.provider_reference || t.reference,
            created_at: t.created_at,
            user_label: p?.full_name || p?.email || t.user_id.slice(0, 8),
          };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (v?: number) => formatNaira(n(v), false);

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Live operations overview from your database"
      actions={
        <button
          type="button"
          onClick={() => void load()}
          className="press flex h-10 items-center gap-2 rounded-xl border bg-card px-3 text-xs font-bold"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Refresh
        </button>
      }
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {error}. If this mentions a missing function, apply migration{" "}
          <code className="text-xs">20260814140000_admin_ops_platform.sql</code> in Supabase.
        </div>
      ) : null}

      {loading && !stats.total_users ? (
        <AdminLoading label="Loading KPIs…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <KpiCard label="Total users" value={String(n(stats.total_users))} />
            <KpiCard label="Active users" value={String(n(stats.active_users))} />
            <KpiCard
              label="New users today"
              value={String(n(stats.new_users_today))}
              delta={pctChange(n(stats.new_users_today), n(stats.new_users_yesterday))}
              hint="vs yesterday"
            />
            <KpiCard
              label="New users this week"
              value={String(n(stats.new_users_week))}
              delta={pctChange(n(stats.new_users_week), n(stats.new_users_prev_week))}
              hint="vs prior week"
            />
            <KpiCard label="Total wallet balance" value={money(stats.wallet_balance_total)} />
            <KpiCard label="Total funding" value={money(stats.funding_total)} />
            <KpiCard
              label="Today's funding"
              value={money(stats.funding_today)}
              delta={pctChange(n(stats.funding_today), n(stats.funding_yesterday))}
              hint="vs yesterday"
            />
            <KpiCard label="Successful tx today" value={String(n(stats.tx_successful_today))} />
            <KpiCard label="Failed tx today" value={String(n(stats.tx_failed_today))} />
            <KpiCard label="Pending transactions" value={String(n(stats.tx_pending))} />
            <KpiCard label="Transaction volume" value={money(stats.tx_volume_successful)} />
            <KpiCard
              label="Revenue / fees"
              value={money(stats.revenue_fees)}
              hint="No fee ledger yet — shows 0 until fees exist"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold",
                  days === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {d}d
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4 shadow-card">
              <p className="mb-3 text-sm font-bold">Transaction volume (₦)</p>
              {series.length === 0 ? (
                <AdminEmpty title="No data available yet" body="Volume appears as wallet transactions are recorded." />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} />
                      <YAxis tickLine={false} axisLine={false} fontSize={10} />
                      <Tooltip />
                      <Area type="monotone" dataKey="volume" stroke="var(--color-primary)" fill="var(--color-primary-soft)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-card">
              <p className="mb-3 text-sm font-bold">Funding volume (₦)</p>
              {series.length === 0 ? (
                <AdminEmpty title="No funding data yet" body="Paystack deposits will populate this chart." />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} />
                      <YAxis tickLine={false} axisLine={false} fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="funding" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Service breakdown</p>
                <Link to="/admin/services" className="text-xs font-bold text-primary">
                  View all
                </Link>
              </div>
              {services.length === 0 ? (
                <AdminEmpty title="No bill transactions yet" body="Service analytics appear when bills are paid." />
              ) : (
                <div className="space-y-2">
                  {services.slice(0, 8).map((s) => {
                    const rate = s.total ? Math.round((s.successful / s.total) * 100) : 0;
                    return (
                      <div key={s.service} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold capitalize">{s.service}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.successful}/{s.total} ok · {rate}% success
                          </p>
                        </div>
                        <p className="font-bold">{formatNaira(n(s.volume), false)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Live activity</p>
                <Link to="/admin/activity" className="text-xs font-bold text-primary">
                  View all
                </Link>
              </div>
              {feed.length === 0 ? (
                <AdminEmpty title="No activity yet" body="Wallet and bill events will show here." />
              ) : (
                <div className="space-y-2">
                  {feed.slice(0, 10).map((f) => (
                    <div key={f.id} className="flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{f.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {f.user_label} · {f.reference}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(f.created_at).toLocaleString("en-NG")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold">{formatNaira(f.amount, false)}</p>
                        <StatusBadge status={f.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/admin/transactions" search={{ q: "", status: "all" }} className="rounded-xl border bg-card px-4 py-2 text-xs font-bold">
              All transactions
            </Link>
            <Link to="/admin/transactions" search={{ q: "", status: "failed" }} className="rounded-xl border bg-card px-4 py-2 text-xs font-bold">
              Failed monitor
            </Link>
            <Link to="/admin/transactions" search={{ q: "", status: "pending" }} className="rounded-xl border bg-card px-4 py-2 text-xs font-bold">
              Pending queue
            </Link>
            <Link to="/admin/users" search={{ q: "", status: "all" }} className="rounded-xl border bg-card px-4 py-2 text-xs font-bold">
              Users
            </Link>
          </div>
        </>
      )}
    </AdminShell>
  );
}
