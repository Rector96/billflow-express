import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Wallet,
  History,
  User,
  ScanLine,
  LayoutGrid,
  Bell,
  Bookmark,
  LifeBuoy,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

type NavItem = { to: string; label: string; icon: LucideIcon };

const NAV_HOME: NavItem = { to: "/home", label: "Home", icon: Home };
const NAV_WALLET: NavItem = { to: "/wallet", label: "Wallet", icon: Wallet };
const NAV_HISTORY: NavItem = { to: "/history", label: "History", icon: History };
const NAV_PROFILE: NavItem = { to: "/profile", label: "Profile", icon: User };

const MAIN_NAV: NavItem[] = [NAV_HOME, NAV_WALLET, NAV_HISTORY, NAV_PROFILE];

const DESKTOP_EXTRA: NavItem[] = [
  { to: "/services", label: "Services", icon: LayoutGrid },
  { to: "/saved-payments", label: "Saved Payments", icon: Bookmark },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/security", label: "Security", icon: ShieldCheck },
  { to: "/support", label: "Support", icon: LifeBuoy },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={BRAND.markUrl}
      alt={`${BRAND.name} logo`}
      width={96}
      height={96}
      loading="eager"
      decoding="async"
      className={cn("size-9 shrink-0 rounded-2xl object-contain ring-1 ring-black/5", className)}
    />
  );
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src={BRAND.logoUrl}
      alt={`${BRAND.name} — ${BRAND.tagline}`}
      width={304}
      height={243}
      loading="eager"
      decoding="async"
      className={cn(
        "h-[clamp(2.75rem,12vw,4.5rem)] w-auto max-w-[min(100%,16rem)] shrink-0 object-contain object-left",
        className,
      )}
    />
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { authed, hydrated } = useApp();
  const navigate = useNavigate();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (hydrated && !authed) void navigate({ to: "/login", replace: true });
  }, [hydrated, authed, navigate]);

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <div className="min-h-dvh bg-background lg:flex">
      {offline ? (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 bg-warning px-4 py-2 text-center text-xs font-bold text-warning-foreground shadow-soft"
        >
          You're offline — payments and top-ups can't be completed right now.
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-6 lg:flex">
        <Link to="/home" className="mb-8 flex items-center gap-2.5 px-2">
          <BrandMark />
          <div className="min-w-0">
            <span className="block text-base font-extrabold tracking-tight">{BRAND.name}</span>
            <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {BRAND.tagline}
            </span>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Main">
          {[...MAIN_NAV, ...DESKTOP_EXTRA].map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "press flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                <item.icon className={cn("size-[18px]", active && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          to="/services"
          className="press brand-gradient mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold text-primary-foreground shadow-sm"
        >
          <ScanLine className="size-4" /> Pay a bill
        </Link>
      </aside>

      <div className="page-fade mx-auto w-full max-w-2xl flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:max-w-3xl lg:pb-10">
        {children}
      </div>

      <nav
        aria-label="Bottom navigation"
        className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none lg:hidden"
      >
        <div className="mx-auto flex max-w-sm items-center justify-around rounded-2xl border border-border/80 bg-card/95 px-2 py-1.5 shadow-float backdrop-blur-md pointer-events-auto">
          <TabLink item={NAV_HOME} active={isActive("/home")} />
          <TabLink item={NAV_WALLET} active={isActive("/wallet")} />
          <Link
            to="/services"
            aria-label="Pay a bill"
            className="press group relative flex flex-col items-center justify-center px-1"
          >
            <span className="brand-gradient grid size-11 place-items-center rounded-xl text-primary-foreground shadow-sm transition-transform group-active:scale-95">
              <ScanLine className="size-5 stroke-[2]" />
            </span>
          </Link>
          <TabLink item={NAV_HISTORY} active={isActive("/history")} />
          <TabLink item={NAV_PROFILE} active={isActive("/profile")} />
        </div>
      </nav>
    </div>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      className={cn(
        "press relative flex min-w-11 flex-col items-center justify-center py-1 transition-all",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "grid size-8.5 place-items-center rounded-xl transition-colors",
          active ? "bg-primary-soft text-primary" : "bg-transparent",
        )}
      >
        <item.icon className={cn("size-4.5", active ? "stroke-[2.2]" : "stroke-[1.8]")} />
      </span>
      <span className="mt-0.5 text-[10px] font-medium leading-none tracking-tight">
        {item.label}
      </span>
    </Link>
  );
}
