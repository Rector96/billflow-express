/**
 * Route: /nin
 *
 * NIN services are intentionally held back until an authorized NIN provider
 * and fulfillment workflow are connected. The existing UI remains available
 * in source for development, but customers must not be charged for an
 * unfulfilled NIN service.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { NinServicesFlow } from "@/components/app/nin-services-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";
import { isBillLive } from "@/lib/product-mode";

export const Route = createFileRoute("/nin")({
  head: () => ({
    meta: [
      { title: `NIN Services — ${BRAND.name}` },
      {
        name: "description",
        content: "NIN services will be available when verified fulfillment is connected.",
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

  if (!isBillLive("nin")) {
    return (
      <AppShell>
        <PageHeader title="NIN Services" backTo="/services" />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
            <ShieldCheck className="size-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold">NIN services are coming soon</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We are waiting for an authorized NIN provider and fulfillment partner before accepting
            payment. We will never present a simulated NIN result as an official record.
          </p>
        </div>
      </AppShell>
    );
  }

  return <NinServicesFlow fees={fees} />;
}
