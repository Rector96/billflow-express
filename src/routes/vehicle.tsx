/**
 * Route: /vehicle
 *
 * Vehicle registry verification and renewal are held back until the verified
 * registry provider and downstream issuance/insurance fulfillment are ready.
 * This route-level gate complements the server-side provider check.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { VehiclePaperworkFlow } from "@/components/app/vehicle-paperwork-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";
import { isBillLive } from "@/lib/product-mode";

export const Route = createFileRoute("/vehicle")({
  head: () => ({
    meta: [
      { title: `Vehicle papers — ${BRAND.name}` },
      {
        name: "description",
        content: "Vehicle services will be available when verified provider fulfillment is connected.",
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

  if (!isBillLive("vehicle")) {
    return (
      <AppShell>
        <PageHeader title="Vehicle Services" backTo="/services" />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
            <ShieldCheck className="size-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold">Vehicle services are coming soon</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We are waiting for verified vehicle-registry access and authorized fulfillment before
            accepting payment. No simulated vehicle records are used for customers.
          </p>
        </div>
      </AppShell>
    );
  }

  return <VehiclePaperworkFlow fees={fees} />;
}
