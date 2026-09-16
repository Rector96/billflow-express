/**
 * Route: /documents — preview opens DocumentsFlow; production uses isBillLive.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { DocumentsFlow } from "@/components/app/documents-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";
import { isHubDemoOnly, isServiceFlowOpen } from "@/lib/product-mode";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: `Documents — ${BRAND.name}` },
      {
        name: "description",
        content: "Document drafts and generators on RockPay.",
      },
    ],
  }),
  loader: async () => {
    const fees = await loadHubFeesFromSupabase();
    return { fees };
  },
  component: DocumentsPage,
});

function DocumentsPage() {
  const { fees } = Route.useLoaderData();

  if (isServiceFlowOpen("documents")) {
    return (
      <>
        {isHubDemoOnly("documents") ? (
          <div className="mx-4 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            Demo flow — drafts are for UX testing; not a paid legal filing.
          </div>
        ) : null}
        <DocumentsFlow fees={fees} />
      </>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Documents" backTo="/services" />
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <ShieldCheck className="size-7" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold">Document service is coming soon</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Preview is off. Enable hub preview or finish secure payment + PDF delivery.
        </p>
      </div>
    </AppShell>
  );
}
