import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Plus, Wallet as WalletIcon } from "lucide-react";
import { formatNaira } from "@/lib/mock-data";
import { AppShell } from "@/components/app/app-shell";
import { SectionTitle, TransactionRow } from "@/components/app/ui-bits";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";

const QUICK_AMOUNTS = [1000, 5000, 10000, 20000];

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: `Wallet — ${BRAND.name}` },
      { name: "description", content: "Fund your wallet and track every top-up and payment." },
      { property: "og:title", content: `Wallet — ${BRAND.name}` },
      { property: "og:description", content: "One balance for all your bills." },
    ],
  }),
  component: WalletLayout,
});

function WalletLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/wallet") return <Outlet />;
  return <WalletPage />;
}

function WalletPage() {
  const { balance, hideBalance, toggleBalance, transactions } = useApp();

  return (
    <AppShell>
      <header className="px-4 pt-4 pb-2 lg:px-0 lg:pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link
              to="/home"
              aria-label="Back to home"
              className="press grid size-9 place-items-center rounded-full border border-border/80 bg-card text-foreground shadow-sm hover:bg-secondary lg:hidden"
            >
              <ArrowLeft className="size-4" strokeWidth={1.8} />
            </Link>
            <div className="flex items-center gap-2.5">
              <span className="hidden size-9 place-items-center rounded-xl bg-primary-soft text-primary lg:grid">
                <WalletIcon className="size-4.5" strokeWidth={1.8} />
              </span>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">My Wallet</h1>
                <p className="text-xs text-muted-foreground">Balance and funding</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="wallet-page-wash min-h-[calc(100dvh-5rem)] space-y-5 px-4 pt-2 pb-8 lg:px-0 lg:space-y-6">
        {/* Top: Balance + Quick Fund side-by-side on desktop */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-5">
          <section className="wallet-surface relative overflow-hidden rounded-2xl border border-primary-foreground/10 p-5 text-primary-foreground shadow-float lg:p-6">
            <span className="wallet-glow pointer-events-none absolute -right-10 -top-12 size-40 rounded-full blur-2xl" />
            <span className="wallet-glow pointer-events-none absolute -bottom-16 -left-10 size-32 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/12 px-2.5 py-1 text-xs font-medium text-primary-foreground/80">
                  <span className="size-1.5 rounded-full bg-success" />
                  Available Balance
                </span>
                <button
                  type="button"
                  onClick={toggleBalance}
                  aria-label={hideBalance ? "Show balance" : "Hide balance"}
                  className="press grid size-8 place-items-center rounded-full bg-primary-foreground/12 text-primary-foreground transition-colors hover:bg-primary-foreground/20"
                >
                  {hideBalance ? (
                    <EyeOff className="size-4" strokeWidth={1.8} />
                  ) : (
                    <Eye className="size-4" strokeWidth={1.8} />
                  )}
                </button>
              </div>

              <p className="mt-3.5 text-3xl font-bold tabular-nums text-primary-foreground lg:text-4xl">
                {hideBalance ? "₦ • • • • • •" : formatNaira(balance)}
              </p>

              <div className="mt-5 flex gap-2.5">
                <Link
                  to="/wallet/fund"
                  search={{}}
                  className="press flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary-foreground text-xs font-semibold text-primary shadow-sm hover:bg-primary-foreground/90"
                >
                  <Plus className="size-4 stroke-[2.2]" /> Fund Wallet
                </Link>
                <Link
                  to="/services"
                  className="press inline-flex h-10 items-center justify-center rounded-xl bg-primary-foreground/12 px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/20"
                >
                  Pay a bill
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-card lg:p-5">
            <SectionTitle title="Quick Fund" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              {QUICK_AMOUNTS.map((q) => (
                <Link
                  key={q}
                  to="/wallet/fund"
                  search={{ amount: q }}
                  className="press flex h-11 items-center justify-center rounded-xl border border-border/80 bg-background text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
                >
                  {formatNaira(q, false)}
                </Link>
              ))}
            </div>
            <Link
              to="/wallet/fund"
              search={{}}
              className="press mt-3 flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary-soft/40 text-xs font-medium text-primary transition-colors hover:bg-primary-soft"
            >
              <Plus className="size-3.5 stroke-[2.2]" /> Custom amount
            </Link>
          </section>
        </div>

        <section>
          <SectionTitle title="Recent Activity" action="See all" to="/history" />
          {transactions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/80 bg-card py-8 text-center text-xs text-muted-foreground">
              No wallet activity yet.
            </p>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {transactions.slice(0, 6).map((tx) => (
                <TransactionRow key={tx.id} tx={tx} compact />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
