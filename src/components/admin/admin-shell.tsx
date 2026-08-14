import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeftRight,
  ClipboardList,
  FileBarChart,
  HeartHandshake,
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
  | "care"
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
  { id: "care", label: "Care", to: "/admin/care", icon: HeartHandshake },
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
  if (pathname.startsWith("/admin/care")) return "care";
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
    if (/^RP-/i.test(term)) {
      window.location.href = `/admin/care?q=${encodeURIComponent(term)}`;
      return;
    }
    if (/^WAL-|BIL-|TXN-/i.test(term) || term.length > 20) {
      window.location.href = `/admin/transactions?q=${encodeURIComponent(term)}`;
    } else {
      window.location.href = `/admin/users?q=${encodeURIComponent(term)}`;
    }
  };

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <BrandMark className="size-9" />
        <div>
          <p className="text-sm font-extrabold tracking-tight">{BRAND.name}</p>
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
                "press flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <n.icon className={cn("size-4 shrink-0", active && "text-primary")} />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <Link
        to="/home"
        className="press mt-4 flex items-center gap-2 rounded-xl border border-border/80 px-3 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted/50"
      >
        ← Back to app
      </Link>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
        {Sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r bg-sidebar p-4 shadow-float">{Sidebar}</div>
        </div>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur-md lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="press grid size-10 place-items-center rounded-xl border border-border/80 bg-card shadow-soft lg:hidden"
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
                placeholder="Search users, Care, refs…"
                className="h-10 w-full rounded-xl border border-border/80 bg-card pr-3 pl-9 text-sm shadow-soft outline-none focus:ring-2 focus:ring-primary/25"
              />
            </form>
            {actions}
          </div>
        </header>
        <div className="page-fade flex-1 px-4 py-5 lg:px-8">{children}</div>
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
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1.5 text-xl font-extrabold tracking-tight tabular-nums">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
        {delta !== undefined ? (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 font-bold",
              delta === null
                ? "bg-muted text-muted-foreground"
                : delta >= 0
                  ? "bg-success-soft text-success"
                  : "bg-destructive-soft text-destructive",
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
    <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 px-6 py-12 text-center">
      <p className="text-sm font-extrabold">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export function AdminLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-3 py-4" aria-busy="true" aria-label={label}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-3 h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="skeleton h-48 w-full rounded-2xl" />
      <p className="text-center text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
