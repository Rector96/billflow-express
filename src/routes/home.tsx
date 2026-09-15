import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, ChevronRight, Plus, Wallet } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { ServiceTile } from "@/components/app/service-tile";
import { StatusBadge } from "@/components/app/status-badge";
import { useApp } from "@/lib/app-store";
import {
  BRAND,
  buildBuyAgain,
  formatNaira,
  getService,
  greeting,
  initialsOf,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: `Home — ${BRAND.name}` },
      {
        name: "description",
        content: "Your wallet balance, quick bill payments and recent transactions at a glance.",
      },
      { property: "og:title", content: `Home — ${BRAND.name}` },
      { property: "og:description", content: "See your balance and pay a bill in two taps." },
    ],
  }),
  component: HomePage,
});

/** Core hub modules — NIN tile covers retrieve + plastic-style card / slip */
const HOME_SERVICES = ["cac", "nin", "tin", "documents", "vehicle", "education"] as const;

function serviceHref(slug: string): { to: string; params?: { slug: string } } {
  if (slug === "cac") return { to: "/cac" };
  if (slug === "nin") return { to: "/nin" };
  if (slug === "tin") return { to: "/tin" };
  if (slug === "documents") return { to: "/documents" };
  if (slug === "vehicle") return { to: "/vehicle" };
  return { to: "/pay/$slug", params: { slug } };
}

function HomePage() {
  const navigate = useNavigate();
  const { profile, transactions, saved, unreadCount } = useApp();
  const firstName = (profile.name.split(" ")[0] || "there").trim();

  const buyAgain = useMemo(() => buildBuyAgain(transactions, saved, 3), [transactions, saved]);

  const savedHome = useMemo(() => {
    const seen = new Set<string>();
    const out = [];
    for (const item of saved) {
      const key = `${item.serviceSlug}|${item.provider}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= 2) break;
    }
    return out;
  }, [saved]);

  const recent = useMemo(() => transactions.slice(0, 3), [transactions]);
  const serviceTiles = HOME_SERVICES.map((slug) => getService(slug)).filter(Boolean);

  return (
    <AppShell>
      <header className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/profile"
              aria-label="Your profile"
              className="press grid size-10 place-items-center rounded-full border border-border/80 bg-primary-soft text-xs font-bold text-primary shadow-sm"
            >
              {initialsOf(profile.name || "U")}
            </Link>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{greeting()},</p>
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                {firstName}
              </h1>
            </div>
          </div>
          <Link
            to="/notifications"
            className="press relative grid size-10 place-items-center rounded-full border border-border/70 bg-card text-foreground shadow-sm"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            {unreadCount > 0 ? (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive" />
            ) : null}
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-primary-foreground/80">Wallet balance</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">
                {formatNaira(profile.balance, false)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/fund" })}
              className="press inline-flex items-center gap-1.5 rounded-2xl bg-white/15 px-3 py-2 text-xs font-bold backdrop-blur"
            >
              <Plus className="size-3.5" /> Fund
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-primary-foreground/85">
            <Wallet className="size-3.5" />
            <span>Secure payments · instant confirmation</span>
          </div>
        </div>
      </header>

      <section className="px-4 pb-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold tracking-tight">Services</h2>
          <Link to="/services" className="text-xs font-semibold text-primary">
            See all
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3">
          {serviceTiles.map((s) =>
            s ? (
              <Link
                key={s.slug}
                to={serviceHref(s.slug).to}
                params={serviceHref(s.slug).params}
                className="press"
              >
                <ServiceTile
                  name={s.short || s.name}
                  icon={s.icon}
                  tint={s.tint}
                />
              </Link>
            ) : null,
          )}
        </div>
      </section>

      {savedHome.length > 0 ? (
        <section className="px-4 pb-3">
          <h2 className="mb-2 text-sm font-extrabold tracking-tight">Saved</h2>
          <div className="space-y-2">
            {savedHome.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  navigate({
                    to: "/pay/$slug",
                    params: { slug: item.serviceSlug },
                  })
                }
                className="press flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card px-3.5 py-3 text-left shadow-soft"
              >
                <div>
                  <p className="text-sm font-bold">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.provider}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {buyAgain.length > 0 ? (
        <section className="px-4 pb-3">
          <h2 className="mb-2 text-sm font-extrabold tracking-tight">Buy again</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {buyAgain.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  navigate({
                    to: "/pay/$slug",
                    params: { slug: item.serviceSlug },
                  })
                }
                className="press min-w-[140px] rounded-2xl border border-border/70 bg-card px-3 py-2.5 text-left shadow-soft"
              >
                <p className="truncate text-xs font-bold">{item.title}</p>
                <p className="text-[11px] text-muted-foreground">{formatNaira(item.amount, false)}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="px-4 pb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold tracking-tight">Recent</h2>
          <Link to="/history" className="text-xs font-semibold text-primary">
            History
          </Link>
        </div>
        <div className="space-y-2">
          {recent.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
              No transactions yet
            </p>
          ) : (
            recent.map((tx) => (
              <Link
                key={tx.id}
                to="/history/$txId"
                params={{ txId: tx.id }}
                className={cn(
                  "press flex items-center justify-between rounded-2xl border border-border/70 bg-card px-3.5 py-3 shadow-soft",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{tx.title}</p>
                  <p className="text-[11px] text-muted-foreground">{tx.service}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold tabular-nums">{formatNaira(tx.amount, false)}</p>
                  <StatusBadge status={tx.status} className="mt-0.5" />
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
