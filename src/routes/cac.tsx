/**
 * Route: /cac
 * CAC Business Name registration (demo UI until production connection).
 * See docs/CAC_BUSINESS_NAME.md and src/components/app/cac-registration-flow.tsx
 */
import { createFileRoute } from "@tanstack/react-router";
import { CacRegistrationFlow } from "@/components/app/cac-registration-flow";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/cac")({
  head: () => ({
    meta: [
      { title: `CAC Registration — ${BRAND.name}` },
      {
        name: "description",
        content:
          "Register a CAC Business Name on RockPay. Demo mode until production filing is connected.",
      },
    ],
  }),
  component: CacRegistrationFlow,
});
