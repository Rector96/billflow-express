import { createFileRoute, Link } from "@tanstack/react-router";
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
import { formatNaira, INITIAL_TRANSACTIONS } from "@/lib/mock-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Admin dashboard — ${BRAND.name}` },
      { name: "description", content: "Operational overview of users, wallets and transactions." },
      { property: "og:title", content: `Admin dashboard — ${BRAND.name}` },
      { property: "og:description", content: "Mock analytics for the internal team." },
      { name: "robots", content: "noindex" },
    ],
  }),
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

const STATS = [
  { label: "Total Users", value: "12,480" },
  { label: "Wallet Deposits", value: formatNaira(48250000, false) },
  { label: "Bill Payments", value: formatNaira(39120000, false) },
  { label: "Revenue", value: formatNaira(1860000, false) },
  { label: "Successful", value: "24,918" },
  { label: "Pending", value: "312" },
  { label: "Failed", value: "148" },
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

function AdminPage() {
  return (
    <div className="min-h-dvh bg-background lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-5 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <BrandMark />
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
            <p className="text-sm text-muted-foreground">Mock analytics — no backend connected.</p>
          </div>
          <Link
            to="/profile"
            className="press flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-bold"
          >
            <ArrowLeft className="size-4" /> Back to app
          </Link>
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
            <p className="mb-3 text-sm font-bold">Transaction volume (₦m)</p>
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
            <p className="mb-3 text-sm font-bold">Service mix (%)</p>
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
          <p className="mb-3 text-sm font-bold">Latest transactions</p>
          <div className="space-y-2">
            {INITIAL_TRANSACTIONS.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-sm sm:grid-cols-[1fr_1fr_auto_auto]"
              >
                <span className="truncate font-semibold">{t.title}</span>
                <span className="hidden truncate text-muted-foreground sm:block">{t.service}</span>
                <span className="hidden font-bold sm:block">{formatNaira(t.amount, false)}</span>
                <StatusBadge status={t.status} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
