/**
 * Route: /nin — NIN services with live fees + delivery choice
 */
import { createFileRoute } from "@tanstack/react-router";
import { NinServicesFlow } from "@/components/app/nin-services-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";

export const Route = createFileRoute("/nin")({
  head: () => ({
    meta: [
      { title: `NIN Services — ${BRAND.name}` },
      {
        name: "description",
        content: "Retrieve your NIN, download a slip, or order a plastic ID card on RockPay.",
      },
    ],
  }),
  loader: async () => {
    const fees = await loadHubFeesFromSupabase();
    return { fees };
  },
  component: NinPage,
});

function NinPage() {
  const { fees } = Route.useLoaderData();
  return <NinServicesFlow fees={fees} />;
}
