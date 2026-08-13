import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { WalletCard } from "@/components/app/wallet-card";
import { SectionTitle, ServiceTile, TransactionRow } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { MoreIcon, SERVICES, getService, greeting, initialsOf } from "@/lib/mock-data";

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
  const { profile, transactions, saved } = useApp();
  const navigate = useNavigate();
  const firstName = profile.name.split(" ")[0] || "there";

  return (
    <AppShell>
      <header className="brand-gradient rounded-b-[2rem] px-4 pt-6 pb-20 text-primary-foreground">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs opacity-85">{greeting()},</p>
            <h1 className="truncate text-xl font-extrabold">{firstName} 👋</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="press relative grid size-10 place-items-center rounded-xl bg-white/15"
            >
              <Bell className="size-5" />
              <span className="absolute top-2 right-2.5 size-2 rounded-full bg-warning" />
            </Link>
            <Link
              to="/profile"
              aria-label="Your profile"
              className="press grid size-10 place-items-center rounded-full border border-white/30 bg-white/15 text-sm font-bold"
            >
              {initialsOf(profile.name)}
            </Link>
          </div>
        </div>
      </header>

      <div className="-mt-16 space-y-7 px-4 pb-6">
        <WalletCard />

        <section>
          <SectionTitle title="Pay Bills" />
          <div className="grid grid-cols-3 gap-3">
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
          <SectionTitle title="Quick Pay" action="See All" to="/saved-payments" />
          <div className="space-y-3">
            {saved
              .filter((item, i, arr) => arr.findIndex((x) => x.serviceSlug === item.serviceSlug) === i)
              .slice(0, 2)
              .map((item) => {
              const svc = getService(item.serviceSlug)!;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card"
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${svc.tint}`}>
                    <svc.icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.provider} • {item.masked}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="press h-9 rounded-lg px-5 font-bold"
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

        <section>
          <SectionTitle title="Recent Transactions" action="See All" to="/history" />
          <div className="space-y-3">
            {transactions.slice(0, 4).map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        </section>

        <section className="flex items-center gap-3 rounded-2xl bg-primary-soft p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            🔒
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">Easy, Reliable, Secure</p>
            <p className="text-xs text-muted-foreground">
              Every payment on {BRAND.name} is recorded and receipted.
            </p>
          </div>
        </section>

        <p className="text-center text-[11px] text-muted-foreground">
          Demo build — {SERVICES.length} services available with sample data.
        </p>
      </div>
    </AppShell>
  );
}
