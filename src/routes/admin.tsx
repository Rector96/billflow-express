import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowLeftRight,
  Boxes,
  Tag,
  LifeBuoy,
  FileBarChart,
  Bell,
  Settings,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from "lucide-react";
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
import { StatusBadge } from "@/components/app/ui-bits";
import { BrandMark } from "@/components/app/app-shell";
import { BRAND } from "@/lib/brand";
import { formatNaira, type TxStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Admin dashboard — ${BRAND.name}` },
      { name: "description", content: "Operational overview of users, wallets and transactions." },
      { property: "og:title", content: `Admin dashboard — ${BRAND.name}` },
      { property: "og:description", content: "Staff operational overview." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.user) {
      throw redirect({ to: "/login" });
    }
    const { data: isStaff, error } = await supabase.rpc("is_staff", {
      _user_id: session.user.id,
    });
    if (error || !isStaff) {
      throw redirect({ to: "/home" });
    }
  },
  component: AdminPage,
});

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Users", icon: Users },
  { label: "Wallets", icon: Wallet },
  { label: "Transactions", icon: ArrowLeftRight },
  { label: "Services", icon: Boxes },
  { label: "Pricing", icon: Tag },
  { label: "Support", icon: LifeBuoy },
  { label: "Reports", icon: FileBarChart },
  { label: "Notifications", icon: Bell },
  { label: "Settings", icon: Settings },
];

const VOLUME = [
  { day: "Mon", value: 4.2 },
  { day: "Tue", value: 5.1 },
  { day: "Wed", value: 4.8 },
  { day: "Thu", value: 6.4 },
  { day: "Fri", value: 7.9 },
  { day: "Sat", value: 6.1 },
  { day: "Sun", value: 5.4 },
];

const MIX = [
  { name: "Electricity", value: 42 },
  { name: "Cable TV", value: 26 },
  { name: "Data", value: 18 },
  { name: "Airtime", value: 9 },
  { name: "Education", value: 5 },
];

type Filter = "all" | TxStatus;

type AdminTx = {
  id: string;
  reference: string;
  type: string;
  amount: number;
  status: TxStatus;
  description: string | null;
  provider: string | null;
  provider_reference: string | null;
  created_at: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_label: string;
};

type Stats = {
  total_users?: number;
  wallet_balance_total?: number;
  bill_volume?: number;
  bill_successful?: number;
  bill_pending?: number;
  bill_failed?: number;
  bill_transactions?: number;
};

function AdminPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AdminTx[]>([]);
  const [stats, setStats] = useState<Stats>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, txRes, profilesRes] = await Promise.all([
        supabase.rpc("admin_dashboard_stats"),
        supabase
          .from("wallet_transactions")
          .select(
            "id, reference, type, amount, status, description, provider, provider_reference, created_at, user_id, metadata",
          )
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("profiles").select("user_id, full_name, email, phone").limit(500),
      ]);

      if (statsRes.data && typeof statsRes.data === "object") {
        setStats(statsRes.data as Stats);
      }

      const profileMap = new Map<
        string,
        { full_name: string | null; email: string | null; phone: string | null }
      >();
      for (const p of profilesRes.data ?? []) {
        profileMap.set(p.user_id, p);
      }

      const mapped: AdminTx[] = (txRes.data ?? []).map((t) => {
        const meta = (t.metadata ?? {}) as Record<string, unknown>;
        const profile = profileMap.get(t.user_id);
        const serviceLabel =
          typeof meta["title"] === "string"
            ? meta["title"]
            : typeof meta["service_label"] === "string"
              ? meta["service_label"]
              : t.description ?? (t.type === "deposit" ? "Wallet funding" : t.type);
        const status: TxStatus =
          t.status === "successful" || t.status === "pending" || t.status === "failed"
            ? t.status
            : "pending";
        return {
          id: t.id,
          reference: t.provider_reference || t.reference,
          type: t.type,
          amount: Number(t.amount),
          status,
          description: t.description,
          provider: t.provider,
          provider_reference: t.provider_reference,
          created_at: t.created_at,
          user_id: t.user_id,
          customer_name: profile?.full_name ?? "—",
          customer_email: profile?.email ?? "—",
          customer_phone: profile?.phone ?? "—",
          service_label: String(serviceLabel),
        };
      });
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  const STATS = [
    { label: "Total Users", value: String(stats.total_users ?? "—") },
    {
      label: "Wallet balances",
      value: stats.wallet_balance_total != null ? formatNaira(Number(stats.wallet_balance_total), false) : "—",
    },
    {
      label: "Bill volume",
      value: stats.bill_volume != null ? formatNaira(Number(stats.bill_volume), false) : "—",
    },
    { label: "Bill payments", value: String(stats.bill_transactions ?? "—") },
    { label: "Successful", value: String(stats.bill_successful ?? "—") },
    { label: "Pending", value: String(stats.bill_pending ?? "—") },
    { label: "Failed", value: String(stats.bill_failed ?? "—") },
  ];

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "successful", label: "Successful" },
    { id: "pending", label: "Pending" },
    { id: "failed", label: "Failed" },
  ];

  return (
    <div className="min-h-dvh bg-background lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-5 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <BrandMark className="size-8" />
          <span className="text-sm font-extrabold">{BRAND.name} Admin</span>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Admin">
          {NAV.map((n) => (
            <span
              key={n.label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                n.active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground"
              }`}
            >
              <n.icon className="size-4" />
              {n.label}
            </span>
          ))}
        </nav>
      </aside>

      <main className="flex-1 px-4 py-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Staff-only operational overview.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="press flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-bold"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh
            </button>
            <Link
              to="/profile"
              className="press flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-bold"
            >
              <ArrowLeft className="size-4" /> Back to app
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-4 shadow-card">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-lg font-extrabold">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <p className="mb-3 text-sm font-bold">Transaction volume (illustrative ₦m)</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={VOLUME}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    fill="var(--color-primary-soft)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <p className="mb-3 text-sm font-bold">Service mix (illustrative %)</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MIX}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border bg-card p-4 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold">Transactions</p>
            <div className="flex flex-wrap gap-1.5">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                    filter === f.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> Loading transactions…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No transactions in this filter.</p>
          ) : (
            <div className="space-y-2">
              {/* Desktop header */}
              <div className="hidden grid-cols-[1.2fr_1fr_0.8fr_0.9fr_0.7fr_0.7fr] gap-2 border-b px-3 pb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase md:grid">
                <span>Customer</span>
                <span>Service / method</span>
                <span>Amount</span>
                <span>Reference</span>
                <span>Date</span>
                <span>Status</span>
              </div>
              {filtered.map((t) => {
                const when = new Date(t.created_at);
                const dateStr = when.toLocaleString("en-NG", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const method =
                  t.provider === "paystack"
                    ? "Paystack"
                    : t.type === "deposit"
                      ? "Wallet top-up"
                      : "Wallet";
                return (
                  <div
                    key={t.id}
                    className="rounded-xl border p-3 text-sm md:grid md:grid-cols-[1.2fr_1fr_0.8fr_0.9fr_0.7fr_0.7fr] md:items-center md:gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{t.customer_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.customer_email}</p>
                      {t.customer_phone !== "—" ? (
                        <p className="truncate text-xs text-muted-foreground">{t.customer_phone}</p>
                      ) : null}
                    </div>
                    <div className="mt-2 min-w-0 md:mt-0">
                      <p className="truncate font-medium">{t.service_label}</p>
                      <p className="text-xs text-muted-foreground">{method}</p>
                    </div>
                    <p className="mt-2 font-bold md:mt-0">{formatNaira(t.amount, false)}</p>
                    <p className="mt-1 truncate font-mono text-[11px] md:mt-0">{t.reference}</p>
                    <p className="mt-1 text-xs text-muted-foreground md:mt-0">{dateStr}</p>
                    <div className="mt-2 md:mt-0">
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
