/**
 * Route: /documents — always opens documents flow on this branch.
 */
import { createFileRoute } from "@tanstack/react-router";
import { DocumentsFlow } from "@/components/app/documents-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";
import { isHubDemoOnly } from "@/lib/product-mode";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: `Documents — ${BRAND.name}` },
      { name: "description", content: "Document drafts and generators on RockPay." },
    ],
  }),
  loader: async () => {
    try {
      const fees = await loadHubFeesFromSupabase();
      return { fees };
    } catch {
      return { fees: {} as Record<string, number> };
    }
  },
  component: DocumentsPage,
});

function DocumentsPage() {
  const { fees } = Route.useLoaderData();
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
