import { createFileRoute } from "@tanstack/react-router";
import { VehiclePaperworkFlow } from "@/components/app/vehicle-paperwork-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";

export const Route = createFileRoute("/vehicle")({
  head: () => ({
    meta: [
      { title: `Vehicle papers — ${BRAND.name}` },
      {
        name: "description",
        content: "Look up vehicle registration and renew paperwork on RockPay.",
      },
    ],
  }),
  loader: async () => {
    const fees = await loadHubFeesFromSupabase();
    return { fees };
  },
  component: VehiclePage,
});

function VehiclePage() {
  const { fees } = Route.useLoaderData();
  return <VehiclePaperworkFlow fees={fees} />;
}
