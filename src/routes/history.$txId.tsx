import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileWarning, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, InfoRow, StatusBadge } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-store";
import { formatNaira } from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/history/$txId")({
  head: ({ params }) => ({
    meta: [
      { title: `Transaction ${params.txId} — ${BRAND.name}` },
      { name: "description", content: "Full receipt details for this transaction." },
      { property: "og:title", content: `Transaction ${params.txId} — ${BRAND.name}` },
      { property: "og:description", content: "View, share or report this payment." },
    ],
  }),
  component: TransactionDetails,
});

function TransactionDetails() {
  const { txId } = Route.useParams();
  const { transactions } = useApp();
  const tx = transactions.find((t) => t.id === txId);

  if (!tx) {
    return (
      <AppShell>
        <PageHeader title="Transaction Details" backTo="/history" />
        <div className="px-4 pt-6">
          <EmptyState
            Icon={FileWarning}
            title="Transaction not found"
            body="This receipt is no longer available in the demo session."
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Transaction Details" backTo="/history" />
      <div className="space-y-5 px-4 pt-2 pb-6">
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-5 shadow-card">
          <StatusBadge status={tx.status} />
          <p className="text-sm font-bold">{tx.title}</p>
          <p className="text-3xl font-extrabold tabular-nums">
            {tx.direction === "in" ? "+" : "-"}
            {formatNaira(tx.amount, false)}
          </p>
        </div>

        <div className="divide-y rounded-2xl border bg-card px-4 py-2 shadow-card">
          <InfoRow label="Transaction ID" value={tx.id} />
          <InfoRow label="Service" value={tx.service} />
          {tx.customer ? <InfoRow label="Customer" value={tx.customer} /> : null}
          {tx.reference ? <InfoRow label="Reference" value={tx.reference} /> : null}
          <InfoRow label="Amount" value={formatNaira(tx.amount)} />
          <InfoRow label="Date" value={tx.date} />
          <InfoRow label="Time" value={tx.time} />
          <InfoRow label="Payment Method" value={tx.method} />
        </div>

        {tx.token ? (
          <div className="rounded-2xl border border-dashed bg-primary-soft p-4 text-center">
            <p className="text-xs font-semibold text-muted-foreground">Electricity Token</p>
            <p className="mt-1 text-lg font-extrabold tracking-[0.15em]">{tx.token}</p>
          </div>
        ) : null}

        <div className="space-y-3">
          <Button
            variant="outline"
            className="h-12 w-full rounded-2xl font-bold"
            onClick={() => toast.success("Receipt shared (demo)")}
          >
            <Share2 className="size-4" /> Share Receipt
          </Button>
          <Button
            variant="outline"
            className="h-12 w-full rounded-2xl font-bold"
            onClick={() => toast.success("Receipt downloaded (demo)")}
          >
            <Download className="size-4" /> Download Receipt
          </Button>
          <Button variant="ghost" className="h-12 w-full rounded-2xl font-bold text-destructive" asChild>
            <Link to="/history/$txId/report" params={{ txId: tx.id }}>
              Report Problem
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
