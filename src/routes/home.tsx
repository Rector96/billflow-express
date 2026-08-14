import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bell, ChevronRight, HeartHandshake } from "lucide-react";
import { AppShell, BrandMark } from "@/components/app/app-shell";
import { WalletCard } from "@/components/app/wallet-card";
import { BuyAgainRail } from "@/components/app/buy-again-rail";
import { SectionTitle, ServiceTile, TransactionRow } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-store";
import { buildBuyAgain } from "@/lib/buy-again";
import { BRAND } from "@/lib/brand";
import { MoreIcon, getService, greeting, initialsOf } from "@/lib/mock-data";
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

const HOME_SERVICES = ["airtime", "data", "electricity", "cable"] as const;

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

  return (
    <AppShell>
      <header className="brand-gradient rounded-b-2xl px-4 pt-4 pb-14 text-primary-foreground">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <BrandMark className="size-8 bg-white/95 p-0.5 ring-white/25" />
            <div className="min-w-0">
              <p className="text-[11px] opacity-90">{greeting()},</p>
              <h1 className="truncate text-base font-extrabold tracking-tight">{firstName} 👋</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              to="/notifications"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              className="press relative grid size-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"
            >
              <Bell className="size-4" />
              {unreadCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-warning px-0.5 text-[9px] font-extrabold text-warning-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <Link
              to="/profile"
              aria-label="Your profile"
              className="press grid size-9 place-items-center rounded-full border border-white/30 bg-white/15 text-xs font-bold"
            >
              {initialsOf(profile.name || "U")}
            </Link>
          </div>
        </div>
      </header>

      <div className="-mt-10 space-y-4 px-4 pb-5">
        <WalletCard />

        {/* PAY BILLS — primary */}
        <section>
          <SectionTitle title="Pay Bills" action="All services" to="/services" />
          <div className="grid grid-cols-5 gap-2">
            {HOME_SERVICES.map((slug) => {
              const s = getService(slug)!;
              return (
                <ServiceTile
                  key={s.slug}
                  label={s.short}
                  Icon={s.icon}
                  tint={s.tint}
                  to="/pay/$slug"
                  params={{ slug: s.slug }}
                  compact
                />
              );
            })}
            <ServiceTile
              label="More"
              Icon={MoreIcon}
              tint="bg-muted text-muted-foreground"
              to="/services"
              compact
            />
          </div>
        </section>

        {/* Quick Pay = Buy Again + Saved — subtle */}
        {(buyAgain.length > 0 || savedHome.length > 0) && (
          <section>
            <SectionTitle title="Quick Pay" action="Saved" to="/saved-payments" />
            <BuyAgainRail items={buyAgain} compact />
            {savedHome.length > 0 ? (
              <div className={cn("space-y-1.5", buyAgain.length > 0 && "mt-1.5")}>
                {savedHome.map((item) => {
                  const svc = getService(item.serviceSlug);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card px-2.5 py-2"
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg",
                          svc?.tint ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {svc ? <svc.icon className="size-3.5" /> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{item.label}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {item.provider} · {item.masked}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 shrink-0 rounded-lg px-3 text-xs font-bold"
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
            ) : null}
          </section>
        )}

        {/* Recent — 3 max */}
        <section>
          <SectionTitle title="Recent" action="View all" to="/history" />
          {recent.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Your payments will show up here.
            </p>
          ) : (
            <div className="space-y-1.5">
              {recent.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} compact />
              ))}
            </div>
          )}
        </section>

        {/* Care — compact row */}
        <Link
          to="/support"
          className="press flex items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3 py-2.5"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <HeartHandshake className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold">RockPay Care</p>
            <p className="text-[10px] text-muted-foreground">Need help with a transaction?</p>
          </div>
          <span className="text-[11px] font-bold text-primary">Get help</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </div>
    </AppShell>
  );
}
