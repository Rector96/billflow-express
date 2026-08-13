import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
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
        <WalletCard label="Available Balance" withWithdraw />

        <section>
          <SectionTitle title="Quick Fund" action="Fund Wallet" to="/wallet/fund" />
          <p className="text-xs text-muted-foreground">
            Top up instantly with a saved card or bank transfer. This demo simulates the payment.
          </p>
        </section>

        <section>
          <SectionTitle title="Recent Activity" action="See All" to="/history" />
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
