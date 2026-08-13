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
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

type NavItem = { to: string; label: string; icon: LucideIcon };

const NAV_HOME: NavItem = { to: "/home", label: "Home", icon: Home };
const NAV_WALLET: NavItem = { to: "/wallet", label: "Wallet", icon: Wallet };
const NAV_HISTORY: NavItem = { to: "/history", label: "History", icon: History };
const NAV_PROFILE: NavItem = { to: "/profile", label: "Profile", icon: User };

const MAIN_NAV: NavItem[] = [
  NAV_HOME,
  NAV_WALLET,
  NAV_HISTORY,
  NAV_PROFILE,
];

const DESKTOP_EXTRA: NavItem[] = [
  { to: "/services", label: "Services", icon: LayoutGrid },
  { to: "/saved-payments", label: "Saved Payments", icon: Bookmark },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/security", label: "Security", icon: ShieldCheck },
  { to: "/support", label: "Support", icon: LifeBuoy },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "brand-gradient grid size-9 shrink-0 place-items-center rounded-xl text-base font-black text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      B
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { authed, hydrated } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !authed) void navigate({ to: "/login", replace: true });
  }, [hydrated, authed, navigate]);

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <div className="min-h-dvh bg-background lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar px-4 py-6 lg:flex">
        <Link to="/home" className="mb-8 flex items-center gap-2 px-2">
          <BrandMark />
          <span className="text-lg font-extrabold tracking-tight">{BRAND.name}</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {[...MAIN_NAV, ...DESKTOP_EXTRA].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "press flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
                isActive(item.to)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          to="/services"
          className="press brand-gradient mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-primary-foreground shadow-float"
        >
          <ScanLine className="size-4" /> Pay a bill
        </Link>
      </aside>

      <div className="mx-auto w-full max-w-2xl flex-1 pb-28 lg:max-w-3xl lg:pb-10">{children}</div>

      <nav
        aria-label="Bottom navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <TabLink item={NAV_HOME} active={isActive("/home")} />
          <TabLink item={NAV_WALLET} active={isActive("/wallet")} />
          <div className="flex justify-center">
            <Link
              to="/services"
              aria-label="Pay a bill"
              className="press brand-gradient -mt-7 grid size-14 place-items-center rounded-2xl text-primary-foreground shadow-float"
            >
              <ScanLine className="size-6" />
            </Link>
          </div>
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
        "press flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl py-1 text-[11px] font-semibold",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <item.icon className={cn("size-5", active && "stroke-[2.4]")} />
      {item.label}
    </Link>
  );
}
