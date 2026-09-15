/**
 * Route: /documents — live document generator fee from pricing_rules
 */
import { createFileRoute } from "@tanstack/react-router";
import { DocumentsFlow } from "@/components/app/documents-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: `Documents — ${BRAND.name}` },
      {
        name: "description",
        content: "Generate business constitution or tenancy agreement drafts on RockPay.",
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
  return <DocumentsFlow fees={fees} />;
}
