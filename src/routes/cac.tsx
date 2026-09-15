/**
 * Route: /cac
 *
 * CAC Business Name assistance remains visible as a coming-soon service until
 * real CAC filing, payment and status tracking are connected. The existing
 * demo UI is retained in source for future development but is not customer
 * payment-enabled through the product route.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { CacRegistrationFlow } from "@/components/app/cac-registration-flow";
import { BRAND } from "@/lib/brand";
import { isBillLive } from "@/lib/product-mode";

export const Route = createFileRoute("/cac")({
  head: () => ({
    meta: [
      { title: `CAC Registration — ${BRAND.name}` },
      {
        name: "description",
        content: "CAC Business Name assistance will be available when production filing is connected.",
      },
    ],
  }),
  component: CacPage,
});

function CacPage() {
  if (!isBillLive("cac")) {
    return (
      <AppShell>
        <PageHeader title="CAC Registration" backTo="/services" />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
            <ShieldCheck className="size-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold">CAC service is coming soon</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We are waiting for a production CAC filing connection before accepting payment or
            presenting a Business Name application as submitted.
          </p>
        </div>
      </AppShell>
    );
  }

  return <CacRegistrationFlow />;
}
