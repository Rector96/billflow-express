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
      {/* Purple hero — matches reference wallet screen */}
      <header className="brand-gradient rounded-b-[1.75rem] px-4 pt-4 pb-8 text-primary-foreground">
        <div className="mb-5 flex items-center gap-3">
          <Link
            to="/home"
            aria-label="Back to home"
            className="press grid size-9 place-items-center rounded-full bg-white/15 ring-1 ring-white/20"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-base font-extrabold">Wallet</h1>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <p className="text-xs font-medium opacity-90">Available Balance</p>
            <button
              type="button"
              onClick={toggleBalance}
              aria-label={hideBalance ? "Show balance" : "Hide balance"}
              className="press grid size-7 place-items-center rounded-full bg-white/15"
            >
              {hideBalance ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
          <p className="mt-1.5 text-[1.85rem] leading-none font-extrabold tracking-tight tabular-nums">
            {hideBalance ? "₦ • • • • • •" : formatNaira(balance)}
          </p>

          <div className="mt-4 flex justify-center">
            <Link
              to="/wallet/fund"
              search={{}}
              className="press inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-white px-6 text-sm font-bold text-primary shadow-soft"
            >
              <Plus className="size-4" /> Fund Wallet
            </Link>
          </div>
        </div>
      </header>

      <div className="space-y-5 px-4 pt-5 pb-6">
        <section>
          <SectionTitle title="Quick Fund" />
          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map((q) => (
              <Link
                key={q}
                to="/wallet/fund"
                search={{ amount: q }}
                className="press flex h-10 items-center justify-center rounded-xl border border-border/60 bg-card text-xs font-bold shadow-soft"
              >
                {formatNaira(q, false)}
              </Link>
            ))}
          </div>
          <Link
            to="/wallet/fund"
            search={{}}
            className="press mt-2.5 flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/30 text-xs font-bold text-primary"
          >
            <Plus className="size-3.5" /> Custom amount
          </Link>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Paystack test mode — credited only after payment is verified.
          </p>
        </section>

        <section>
          <SectionTitle title="Recent Activity" action="See All" to="/history" />
          {transactions.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No wallet activity yet.</p>
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
