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
import { useServerFn } from "@tanstack/react-start";
import { useApp } from "@/lib/app-store";
import { hasTransactionPin } from "@/lib/pin.functions";
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
  const checkPin = useServerFn(hasTransactionPin);

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

  // Force transaction PIN setup (real platforms require this before the app is usable)
  useEffect(() => {
    if (!hydrated || !authed) return;
    const allowWithoutPin =
      pathname === "/setup-pin" ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/otp") ||
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/terms") ||
      pathname.startsWith("/privacy");
    if (allowWithoutPin) return;
    let cancelled = false;
    void checkPin()
      .then((r) => {
        if (!cancelled && !r.hasPin) {
          void navigate({ to: "/setup-pin", replace: true });
        }
      })
      .catch(() => {
        /* network blip — don't trap the user */
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, authed, pathname, checkPin, navigate]);

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <div className="min-h-dvh bg-background lg:flex">
      {offline ? (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 bg-warning px-4 py-2 text-center text-xs font-bold text-warning-foreground shadow-soft"
        >
          You&apos;re offline — payments and top-ups can&apos;t be completed right now.
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
          className="press brand-gradient mt-4 flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-float"
        >
          <ScanLine className="size-4" /> Pay a bill
        </Link>
      </aside>

      <div className="page-fade mx-auto w-full max-w-2xl flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:max-w-3xl lg:pb-10">
        {children}
      </div>

      <nav
        aria-label="Bottom navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 shadow-[0_-8px_24px_-16px_oklch(0.2_0.05_285_/_12%)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-1.5 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
          <TabLink item={NAV_HOME} active={isActive("/home")} />
          <TabLink item={NAV_WALLET} active={isActive("/wallet")} />
          <Link
            to="/services"
            aria-label="Pay a bill"
            className="press flex min-h-12 flex-col items-center justify-end gap-0.5 py-1 text-[10px] font-extrabold tracking-wide text-primary"
          >
            <span className="brand-gradient mb-0.5 grid size-11 place-items-center rounded-full text-primary-foreground shadow-float">
              <ScanLine className="size-5" />
            </span>
            Pay
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
        "press flex min-h-12 flex-col items-center justify-end gap-0.5 py-1 text-[10px] font-bold tracking-wide",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <item.icon className={cn("size-5", active && "text-primary")} />
      {item.label}
    </Link>
  );
}
