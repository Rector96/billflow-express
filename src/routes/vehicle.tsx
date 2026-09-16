/**
 * Route: /vehicle — preview opens VehiclePaperworkFlow; production uses isBillLive.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { VehiclePaperworkFlow } from "@/components/app/vehicle-paperwork-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";
import { isHubDemoOnly, isServiceFlowOpen } from "@/lib/product-mode";

export const Route = createFileRoute("/vehicle")({
  head: () => ({
    meta: [
      { title: `Vehicle papers — ${BRAND.name}` },
      {
        name: "description",
        content: "Vehicle lookup and renewal helpers on RockPay.",
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

  if (isServiceFlowOpen("vehicle")) {
    return (
      <>
        {isHubDemoOnly("vehicle") ? (
          <div className="mx-4 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            Demo flow — not a real motor licensing office submission.
          </div>
        ) : null}
        <VehiclePaperworkFlow fees={fees} />
      </>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Vehicle Services" backTo="/services" />
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <ShieldCheck className="size-7" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold">Vehicle services are coming soon</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Preview is off. Enable hub preview or connect verified registry fulfillment.
        </p>
      </div>
    </AppShell>
  );
}
