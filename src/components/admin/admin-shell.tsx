import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeftRight,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Shield,
  Users,
  Wallet,
  Boxes,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/app/app-shell";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/admin";

export type AdminNavId =
  | "dashboard"
  | "users"
  | "transactions"
  | "wallet"
  | "services"
  | "reports"
  | "activity"
  | "audit"
  | "staff"
  | "settings";

const NAV: { id: AdminNavId; label: string; to: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { id: "users", label: "Users", to: "/admin/users", icon: Users },
  { id: "transactions", label: "Transactions", to: "/admin/transactions", icon: ArrowLeftRight },
  { id: "wallet", label: "Wallet", to: "/admin/wallet", icon: Wallet },
  { id: "services", label: "Services", to: "/admin/services", icon: Boxes },
  { id: "reports", label: "Reports", to: "/admin/reports", icon: FileBarChart },
  { id: "activity", label: "Activity", to: "/admin/activity", icon: Activity },
  { id: "audit", label: "Audit Logs", to: "/admin/audit-logs", icon: ClipboardList },
  { id: "staff", label: "Staff", to: "/admin/staff", icon: Shield },
  { id: "settings", label: "Settings", to: "/admin/settings", icon: Settings },
];

function activeId(pathname: string): AdminNavId {
  if (pathname.startsWith("/admin/users")) return "users";
  if (pathname.startsWith("/admin/transactions")) return "transactions";
  if (pathname.startsWith("/admin/wallet")) return "wallet";
  if (pathname.startsWith("/admin/services")) return "services";
  if (pathname.startsWith("/admin/reports")) return "reports";
  if (pathname.startsWith("/admin/activity")) return "activity";
  if (pathname.startsWith("/admin/audit-logs")) return "audit";
  if (pathname.startsWith("/admin/staff")) return "staff";
  if (pathname.startsWith("/admin/settings")) return "settings";
  return "dashboard";
}

export function AdminShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = activeId(pathname);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const nav = useMemo(() => NAV, []);

  const searchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    // Route search to transactions or users based on shape
    if (/^WAL-|BIL-|TXN-/i.test(term) || term.length > 20) {
      window.location.href = `/admin/transactions?q=${encodeURIComponent(term)}`;
    } else {
      window.location.href = `/admin/users?q=${encodeURIComponent(term)}`;
    }
  };

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center gap-2 px-2">
        <BrandMark className="size-8" />
        <div>
          <p className="text-sm font-extrabold">{BRAND.name}</p>
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Operations</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Admin">
        {nav.map((n) => {
          const active = current === n.id;
          return (
            <Link
              key={n.id}
              to={n.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <n.icon className="size-4 shrink-0" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <Link
        to="/home"
        className="mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/40"
      >
        ← Back to app
      </Link>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-5 lg:flex">{Sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 border-r bg-sidebar p-4 shadow-xl">{Sidebar}</div>
        </div>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="grid size-10 place-items-center rounded-xl border lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-extrabold tracking-tight">{title}</h1>
              {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>
            <form onSubmit={searchSubmit} className="relative w-full sm:w-64 lg:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search users or refs…"
                className="h-10 w-full rounded-xl border bg-card pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </form>
            {actions}
          </div>
        </header>
        <div className="flex-1 px-4 py-5 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-extrabold tracking-tight">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
        {delta !== undefined ? (
          <span
            className={cn(
              "font-bold",
              delta === null ? "text-muted-foreground" : delta >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {formatPct(delta ?? null)}
          </span>
        ) : null}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}

export function AdminEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

export function AdminLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {label}
    </div>
  );
}
