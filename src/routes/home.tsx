import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bell } from "lucide-react";
import { AppShell, BrandMark } from "@/components/app/app-shell";
import { WalletCard } from "@/components/app/wallet-card";
import { BuyAgainRail } from "@/components/app/buy-again-rail";
import { CareEntryCard } from "@/components/app/care-entry";
import { SectionTitle, ServiceTile, TransactionRow, RowSkeleton } from "@/components/app/ui-bits";
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
  const { profile, transactions, saved, unreadCount, loading, hydrated } = useApp();
  const firstName = (profile.name.split(" ")[0] || "there").trim();

  const buyAgain = useMemo(
    () => buildBuyAgain(transactions, saved, 3),
    [transactions, saved],
  );

  const savedHome = useMemo(() => {
    // Unique by service+provider, max 3
    const seen = new Set<string>();
    const out = [];
    for (const item of saved) {
      const key = `${item.serviceSlug}|${item.provider}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= 3) break;
    }
    return out;
  }, [saved]);

  const recent = useMemo(() => transactions.slice(0, 4), [transactions]);
  const showSkeleton = hydrated && loading && transactions.length === 0 && !profile.name;

  return (
    <AppShell>
      <header className="brand-gradient rounded-b-[1.75rem] px-4 pt-5 pb-16 text-primary-foreground sm:pt-6 sm:pb-20">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="size-9 bg-white/95 p-1 ring-white/30 sm:size-10" />
            <div className="min-w-0">
              <p className="text-xs opacity-90">{greeting()},</p>
              <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
                {firstName} 👋
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/notifications"
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              className="press relative grid size-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"
            >
              <Bell className="size-5" />
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-extrabold text-warning-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <Link
              to="/profile"
              aria-label="Your profile"
              className="press grid size-10 place-items-center rounded-full border border-white/30 bg-white/15 text-sm font-bold"
            >
              {initialsOf(profile.name || "U")}
            </Link>
          </div>
        </div>
      </header>

      <div className="-mt-12 space-y-6 px-4 pb-6 sm:-mt-14 sm:space-y-7">
        <WalletCard />

        {showSkeleton ? (
          <div className="space-y-3" aria-busy="true">
            <div className="skeleton h-4 w-28" />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : (
          <BuyAgainRail items={buyAgain} empty={buyAgain.length === 0} />
        )}

        <section>
          <SectionTitle title="Saved" action="See All" to="/saved-payments" />
          {savedHome.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card/70 px-4 py-5 text-center">
              <p className="text-sm font-bold">Save a service for faster payments</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Save meters, phones and smartcards you use often.
              </p>
              <Button
                variant="outline"
                className="mt-3 h-10 rounded-xl font-bold"
                onClick={() => navigate({ to: "/saved-payments" })}
              >
                Save a Service
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {savedHome.map((item) => {
                const svc = getService(item.serviceSlug);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-card"
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-xl",
                        svc?.tint ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {svc ? <svc.icon className="size-5" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{item.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.provider} • {item.masked}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="h-9 rounded-xl px-4 font-bold"
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
          )}
        </section>

        <section>
          <SectionTitle title="Pay Bills" />
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-3">
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
                />
              );
            })}
            <ServiceTile
              label="More"
              Icon={MoreIcon}
              tint="bg-muted text-muted-foreground"
              to="/services"
            />
          </div>
        </section>

        <section>
          <SectionTitle title="Recent Activity" action="View All" to="/history" />
          {recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card/70 px-4 py-6 text-center">
              <p className="text-sm font-bold">Ready when you are</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pay for airtime, data, electricity and more. Your recent payments will show up here.
              </p>
              <Button className="mt-3 h-10 rounded-xl font-bold" onClick={() => navigate({ to: "/services" })}>
                Make a Payment
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recent.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </section>

        <CareEntryCard />
      </div>
    </AppShell>
  );
}
