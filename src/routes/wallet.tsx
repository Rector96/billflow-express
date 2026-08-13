import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { formatNaira } from "@/lib/mock-data";

const QUICK_AMOUNTS = [1000, 5000, 10000, 20000];
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { WalletCard } from "@/components/app/wallet-card";
import { SectionTitle, TransactionRow } from "@/components/app/ui-bits";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";

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
  const { transactions } = useApp();
  return (
    <AppShell>
      <PageHeader title="Wallet" backTo="/home" />
      <div className="space-y-7 px-4 pt-2 pb-6">
        <WalletCard label="Available Balance" />

        <section>
          <SectionTitle title="Quick Fund" action="Fund Wallet" to="/wallet/fund" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK_AMOUNTS.map((q) => (
              <Link
                key={q}
                to="/wallet/fund"
                search={{ amount: q }}
                className="press flex h-12 items-center justify-center rounded-xl border bg-card text-sm font-bold shadow-card"
              >
                {formatNaira(q, false)}
              </Link>
            ))}
          </div>
          <Link
            to="/wallet/fund"
            search={{}}
            className="press mt-3 flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-bold text-primary"
          >
            <Plus className="size-4" /> Enter a custom amount
          </Link>
          <p className="mt-2 text-xs text-muted-foreground">
            Demo mode — top-ups are simulated instantly. No card or bank transfer is processed.
          </p>
        </section>

        <section>
          <SectionTitle title="Wallet Activity" action="See All" to="/history" />
          <div className="space-y-3">
            {transactions.slice(0, 5).map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
