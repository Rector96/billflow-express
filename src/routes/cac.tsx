/**
 * Route: /cac — always opens the registration flow on this branch.
 */
import { createFileRoute } from "@tanstack/react-router";
import { CacRegistrationFlow } from "@/components/app/cac-registration-flow";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/cac")({
  head: () => ({
    meta: [
      { title: `CAC Registration — ${BRAND.name}` },
      { name: "description", content: "CAC Business Name registration on RockPay." },
      { property: "og:title", content: `CAC Registration — ${BRAND.name}` },
      { property: "og:description", content: "Prepare your Business Name application with RockPay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CacPage,
});

function CacPage() {
  return (
    <>
      <CacRegistrationFlow />
    </>
  );
}
