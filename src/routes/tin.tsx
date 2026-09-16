/**
 * Route: /tin — preview opens TinJtbFlow; production uses isBillLive.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { TinJtbFlow } from "@/components/app/tin-jtb-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";
import { isHubDemoOnly, isServiceFlowOpen } from "@/lib/product-mode";

export const Route = createFileRoute("/tin")({
  head: () => ({
    meta: [
      { title: `TIN Retrieval — ${BRAND.name}` },
      {
        name: "description",
        content: "TIN retrieval helpers on RockPay.",
      },
    ],
  }),
  loader: async () => {
    const fees = await loadHubFeesFromSupabase();
    return { fees };
  },
  component: TinPage,
});

function TinPage() {
  const { fees } = Route.useLoaderData();

  if (isServiceFlowOpen("tin")) {
    return (
      <>
        {isHubDemoOnly("tin") ? (
          <div className="mx-4 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            Demo flow — not an official JTB TIN record.
          </div>
        ) : null}
        <TinJtbFlow fees={fees} />
      </>
    );
  }

  return (
    <AppShell>
      <PageHeader title="TIN Retrieval" backTo="/services" />
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <ShieldCheck className="size-7" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold">TIN retrieval is coming soon</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Preview is off. Enable hub preview or connect a verified TIN provider.
        </p>
      </div>
    </AppShell>
  );
}
