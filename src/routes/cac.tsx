/**
 * Route: /cac — always opens the registration flow on this branch.
 */
import { createFileRoute } from "@tanstack/react-router";
import { CacRegistrationFlow } from "@/components/app/cac-registration-flow";
import { BRAND } from "@/lib/brand";
import { isHubDemoOnly } from "@/lib/product-mode";

export const Route = createFileRoute("/cac")({
  head: () => ({
    meta: [
      { title: `CAC Registration — ${BRAND.name}` },
      { name: "description", content: "CAC Business Name registration on RockPay." },
    ],
  }),
  component: CacPage,
});

function CacPage() {
  return (
    <>
      {isHubDemoOnly("cac") ? (
        <p className="mx-4 mt-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-center text-[10px] font-medium text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/50 dark:text-amber-100">
          Demo · no real CAC filing yet
        </p>
      ) : null}
      <CacRegistrationFlow />
    </>
  );
}
