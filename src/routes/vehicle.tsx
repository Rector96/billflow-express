import { createFileRoute } from "@tanstack/react-router";
import { VehiclePaperworkFlow } from "@/components/app/vehicle-paperwork-flow";
import { BRAND } from "@/lib/mock-data";

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
  component: VehiclePage,
});

function VehiclePage() {
  return <VehiclePaperworkFlow />;
}
