/**
 * Route: /tin
 *
 * TIN retrieval is intentionally unavailable until a verified production TIN
 * provider is configured. The server function has the same gate, so direct
 * navigation cannot bypass the service-status decision.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { TinJtbFlow } from "@/components/app/tin-jtb-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";
import { isBillLive } from "@/lib/product-mode";

export const Route = createFileRoute("/tin")({
  head: () => ({
    meta: [
      { title: `TIN Retrieval — ${BRAND.name}` },
      {
        name: "description",
        content: "TIN retrieval will be available when a verified provider is connected.",
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

  if (!isBillLive("tin")) {
    return (
      <AppShell>
        <PageHeader title="TIN Retrieval" backTo="/services" />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
            <ShieldCheck className="size-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold">TIN retrieval is coming soon</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We are waiting for verified TIN provider access before accepting payment or returning a TIN.
            Your money and records are protected from unverified results.
          </p>
        </div>
      </AppShell>
    );
  }

  return <TinJtbFlow fees={fees} />;
}
