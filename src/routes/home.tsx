import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, Briefcase, HeartHandshake, Search } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { WalletCard } from "@/components/app/wallet-card";
import { HomePromos } from "@/components/app/home-promos";
import { BuyAgainRail } from "@/components/app/buy-again-rail";
import { SectionTitle, ServiceTile, TransactionRow } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-store";
import { buildBuyAgain } from "@/lib/buy-again";
import { BRAND } from "@/lib/brand";
import { readContinueDrafts, type ContinueDraft } from "@/lib/continue-draft";
import { MoreIcon, getService, greeting, initialsOf } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: `Home — ${BRAND.name}` },
      {
        name: "description",
        content: "Everyday payments, official services and recent activity in one place.",
      },
      { property: "og:title", content: `Home — ${BRAND.name}` },
      { property: "og:description", content: "What do you need today? Pay bills or continue applications." },
    ],
  }),
  component: HomePage,
});

/** Hub-first grid: CAC, NIN, TIN, Documents, Vehicle, Education */
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
  const [serviceQuery, setServiceQuery] = useState("");
  const [drafts, setDrafts] = useState<ContinueDraft[]>([]);

  useEffect(() => {
    setDrafts(readContinueDrafts());
  }, []);

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

  function runServiceSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = serviceQuery.trim();
    void navigate({ to: "/services", search: q ? { q } : {} });
  }

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
              <h1 className="text-base font-semibold tracking-tight text-foreground">{firstName}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/notifications"
              aria-label={
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
              }
              className="press relative grid size-9 place-items-center rounded-full border border-border/80 bg-card text-foreground shadow-sm transition-colors hover:bg-secondary"
            >
              <Bell className="size-4" />
              {unreadCount > 0 ? (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-500" />
              ) : null}
            </Link>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-1 pb-6">
        {/* Compact wallet stays — approved hierarchy keeps balance visible */}
        <WalletCard />

        <section className="space-y-2">
          <p className="text-sm font-semibold text-foreground">What do you need today?</p>
          <form onSubmit={runServiceSearch} className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={serviceQuery}
              onChange={(e) => setServiceQuery(e.target.value)}
              placeholder="Search CAC, NIN, data..."
              aria-label="Search services"
              className="h-10.5 rounded-xl border-border/80 bg-card pl-10 text-sm shadow-soft"
            />
          </form>
        </section>

        <HomePromos className="mt-1" />

        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
          <SectionTitle title="Quick Services" action="View all" to="/services" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {serviceTiles.map((s) =>
              s ? (
                <ServiceTile
                  key={s.slug}
                  label={s.short}
                  Icon={s.icon}
                  tint={s.tint}
                  to={serviceHref(s.slug).to}
                  params={serviceHref(s.slug).params}
                />
              ) : null,
            )}
            <ServiceTile
              label="More"
              Icon={MoreIcon}
              tint="bg-secondary text-muted-foreground border border-border/70"
              to="/services"
            />
          </div>
        </section>

        {(buyAgain.length > 0 || savedHome.length > 0) && (
          <section>
            <SectionTitle title="Pay again" action="See all" to="/saved-payments" />
            <div className="space-y-2">
              <BuyAgainRail items={buyAgain} compact />
              {savedHome.map((item) => {
                const svc = getService(item.serviceSlug);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-2.5 shadow-soft"
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-full",
                        svc?.tint ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {svc ? <svc.icon className="size-4" strokeWidth={1.8} /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.provider} · {item.masked}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="h-7.5 shrink-0 rounded-lg px-3 text-xs font-semibold"
                      onClick={() =>
                        navigate({
                          to: "/pay/$slug",
                          params: { slug: item.serviceSlug },
                          search: { saved: item.id },
                        })
                      }
                    >
                      Pay
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {drafts.length > 0 ? (
          <section>
            <SectionTitle title="Continue" />
            <div className="space-y-2">
              {drafts.slice(0, 2).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-soft"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Briefcase className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.stepLabel}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, Math.round((d.step / Math.max(1, d.totalSteps)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 rounded-lg px-3 text-xs font-semibold"
                    onClick={() => void navigate({ to: d.href as "/cac" })}
                  >
                    Continue
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionTitle title="Recent activity" action="See all" to="/history" />
          {recent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/80 bg-card py-6 text-center text-xs text-muted-foreground">
              Your recent payments and applications will appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {recent.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} compact />
              ))}
            </div>
          )}
        </section>

        <Link
          to="/support"
          className="press flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3.5 shadow-card transition-colors hover:border-primary/40"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <HeartHandshake className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">Need help?</p>
            <p className="text-[11px] text-muted-foreground">
              Payments, applications or verification — RockPay Support
            </p>
          </div>
          <span className="text-xs font-medium text-primary">Get help →</span>
        </Link>
      </div>
    </AppShell>
  );
}
