/**
 * Route: /tin — always opens TIN flow on this branch.
 */
import { createFileRoute } from "@tanstack/react-router";
import { TinJtbFlow } from "@/components/app/tin-jtb-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";
import { isHubDemoOnly } from "@/lib/product-mode";

export const Route = createFileRoute("/tin")({
  head: () => ({
    meta: [
      { title: `TIN Retrieval — ${BRAND.name}` },
      { name: "description", content: "TIN retrieval helpers on RockPay." },
    ],
  }),
  loader: async () => {
    try {
      const fees = await loadHubFeesFromSupabase();
      return { fees };
    } catch {
      return { fees: {} as Record<string, number> };
    }
  },
  component: TinPage,
});

function TinPage() {
  const { fees } = Route.useLoaderData();
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
