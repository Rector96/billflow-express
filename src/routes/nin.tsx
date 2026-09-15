/**
 * Route: /nin
 * NIN Retrieve + Print Slip (demo). See docs/NIN_SERVICES.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { NinServicesFlow } from "@/components/app/nin-services-flow";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/nin")({
  head: () => ({
    meta: [
      { title: `NIN Services — ${BRAND.name}` },
      {
        name: "description",
        content: "Retrieve your NIN or print a NIN slip on RockPay. Demo mode until connected.",
      },
    ],
  }),
  component: NinServicesFlow,
});
