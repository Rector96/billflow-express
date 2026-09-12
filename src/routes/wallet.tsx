import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Plus } from "lucide-react";
import { formatNaira } from "@/lib/mock-data";
import { AppShell } from "@/components/app/app-shell";
import { SectionTitle, TransactionRow } from "@/components/app/ui-bits";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";

const QUICK_AMOUNTS = [1000, 5000, 10000];

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
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link
              to="/home"
              aria-label="Back to home"
              className="press grid size-9 place-items-center rounded-full border border-border/80 bg-card text-foreground shadow-sm hover:bg-secondary"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">My Wallet</h1>
              <p className="text-xs text-muted-foreground">Balance and funding</p>
            </div>
          </div>
        </div>
      </header>

      <div className="wallet-page-wash min-h-[calc(100dvh-5rem)] space-y-4 px-4 pt-2 pb-6">
        <section className="wallet-surface relative overflow-hidden rounded-2xl border border-primary-foreground/10 p-5 text-primary-foreground shadow-float">
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
              {hideBalance ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          <p className="mt-3.5 text-3xl font-bold tabular-nums text-primary-foreground">
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
          </div>
          </div>
        </section>

        <section>
          <SectionTitle title="Quick Fund" />
          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map((q) => (
              <Link
                key={q}
                to="/wallet/fund"
                search={{ amount: q }}
                className="press flex h-10 items-center justify-center rounded-xl border border-border/80 bg-card text-xs font-semibold text-foreground shadow-sm hover:border-primary hover:text-primary transition-colors"
              >
                {formatNaira(q, false)}
              </Link>
            ))}
          </div>
          <Link
            to="/wallet/fund"
            search={{}}
            className="press mt-2 flex h-9.5 items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary-soft/40 text-xs font-medium text-primary hover:bg-primary-soft transition-colors"
          >
            <Plus className="size-3.5 stroke-[2.2]" /> Custom amount
          </Link>
        </section>

        <section>
          <SectionTitle title="Recent Activity" action="See all" to="/history" />
          {transactions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/80 bg-card py-6 text-center text-xs text-muted-foreground">
              No wallet activity yet.
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 5).map((tx) => (
                <TransactionRow key={tx.id} tx={tx} compact />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
