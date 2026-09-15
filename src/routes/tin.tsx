/**
 * Route: /tin — JTB TIN with live pricing_rules loader
 */
import { createFileRoute } from "@tanstack/react-router";
import { TinJtbFlow } from "@/components/app/tin-jtb-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";

export const Route = createFileRoute("/tin")({
  head: () => ({
    meta: [
      { title: `TIN Retrieval — ${BRAND.name}` },
      {
        name: "description",
        content: "Retrieve your JTB Tax Identification Number on RockPay.",
      },
    ],
  }),
  loader: async () => {
    const fees = await loadHubFeesFromSupabase();
    return { fees };
  },
  component: TinPage,
});

function TinPage() {
  const { fees } = Route.useLoaderData();
  return <TinJtbFlow fees={fees} />;
}
