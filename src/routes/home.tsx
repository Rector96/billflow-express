import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bell, ChevronRight, HeartHandshake } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
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

const HOME_SERVICES = ["electricity", "cable", "education", "airtime", "data"] as const;

function HomePage() {
  const navigate = useNavigate();
  const { profile, transactions, saved, unreadCount } = useApp();
  const firstName = ((profile?.name ?? "").split(" ")[0] || "there").trim();

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
      <header className="brand-gradient rounded-b-[1.75rem] px-4 pt-5 pb-14 text-primary-foreground">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium opacity-90">{greeting()},</p>
            <h1 className="truncate text-xl font-extrabold tracking-tight">{firstName} 👋</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/notifications"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              className="press relative grid size-10 place-items-center rounded-full bg-white/15 ring-1 ring-white/20"
            >
              <Bell className="size-4" />
              {unreadCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[9px] font-extrabold text-warning-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <Link
              to="/profile"
              aria-label="Your profile"
              className="press grid size-10 place-items-center rounded-full border-2 border-white/40 bg-white/20 text-xs font-bold"
            >
              {initialsOf(profile?.name || "U")}
            </Link>
          </div>
        </div>
      </header>

      <div className="-mt-10 space-y-5 px-4 pb-5">
        <WalletCard />

        <section>
          <SectionTitle title="Pay Bills" action="See all" to="/services" />
          <div className="grid grid-cols-3 gap-2">
            {serviceTiles.map((s) =>
              s ? (
                <ServiceTile
                  key={s.slug}
                  label={s.short}
                  Icon={s.icon}
                  tint={s.tint}
                  to="/pay/$slug"
                  params={{ slug: s.slug }}
                  card
                />
              ) : null,
            )}
            <ServiceTile
              label="More"
              Icon={MoreIcon}
              tint="bg-muted text-muted-foreground"
              to="/services"
              card
            />
          </div>
        </section>

        {(buyAgain.length > 0 || savedHome.length > 0) && (
          <section>
            <SectionTitle title="Quick Pay" action="See All" to="/saved-payments" />
            <div className="space-y-2">
              <BuyAgainRail items={buyAgain} compact />
              {savedHome.map((item) => {
                const svc = getService(item.serviceSlug);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5 shadow-soft"
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-full",
                        svc?.tint ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {svc ? <svc.icon className="size-4" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{item.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.provider} · {item.masked}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 shrink-0 rounded-full px-4 text-xs font-bold"
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

        <section>
          <SectionTitle title="Recent" action="See All" to="/history" />
          {recent.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">Your payments will show up here.</p>
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
          className="press flex items-center gap-3 rounded-2xl bg-card px-3 py-3 shadow-soft"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
            <HeartHandshake className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">RockPay Care</p>
            <p className="text-xs text-muted-foreground">Need help with a payment?</p>
          </div>
          <span className="text-xs font-bold text-primary">Get help</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </div>
    </AppShell>
  );
}
