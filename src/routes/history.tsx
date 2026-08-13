import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { ReceiptText } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, TransactionRow } from "@/components/app/ui-bits";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { TxStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: `Transactions — ${BRAND.name}` },
      { name: "description", content: "Every payment and top-up, filtered by status." },
      { property: "og:title", content: `Transactions — ${BRAND.name}` },
      { property: "og:description", content: "Track successful, pending and failed payments." },
    ],
  }),
  component: HistoryLayout,
});

function HistoryLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/history") return <Outlet />;
  return <HistoryPage />;
}

const TABS: Array<{ key: "all" | TxStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "successful", label: "Successful" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
];

function HistoryPage() {
  const { transactions } = useApp();
  const [tab, setTab] = useState<"all" | TxStatus>("all");
  const list = transactions.filter((t) => tab === "all" || t.status === tab);

  return (
    <AppShell>
      <PageHeader title="Transactions" backTo="/home" />
      <div className="space-y-4 px-4 pt-2 pb-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "press h-9 shrink-0 rounded-full border px-4 text-xs font-bold",
                tab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {list.length ? (
          <div className="space-y-3">
            {list.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        ) : (
          <EmptyState
            Icon={ReceiptText}
            title="Nothing here yet"
            body="Transactions with this status will show up here."
          />
        )}
      </div>
    </AppShell>
  );
}
