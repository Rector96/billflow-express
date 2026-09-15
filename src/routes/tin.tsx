/**
 * Route: /tin
 * JTB TIN Retrieval (demo). See docs/TIN_AND_DOCUMENTS.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { TinJtbFlow } from "@/components/app/tin-jtb-flow";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/tin")({
  head: () => ({
    meta: [
      { title: `TIN Retrieval — ${BRAND.name}` },
      {
        name: "description",
        content: "Retrieve your JTB Tax Identification Number on RockPay. Demo mode until connected.",
      },
    ],
  }),
  component: TinJtbFlow,
});
