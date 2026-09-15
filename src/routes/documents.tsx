/**
 * Route: /documents
 *
 * Document generation is a valid non-government service, but this route stays
 * unavailable until the server-side payment verification and real PDF delivery
 * path are production-ready. A draft/demo download must never be sold as a
 * completed paid document.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { DocumentsFlow } from "@/components/app/documents-flow";
import { BRAND } from "@/lib/brand";
import { loadHubFeesFromSupabase } from "@/lib/hub-pricing.loader";
import { isBillLive } from "@/lib/product-mode";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: `Documents — ${BRAND.name}` },
      {
        name: "description",
        content: "Document generation will be available when secure payment and PDF delivery are ready.",
      },
    ],
  }),
  loader: async () => {
    const fees = await loadHubFeesFromSupabase();
    return { fees };
  },
  component: DocumentsPage,
});

function DocumentsPage() {
  const { fees } = Route.useLoaderData();

  if (!isBillLive("documents")) {
    return (
      <AppShell>
        <PageHeader title="Documents" backTo="/services" />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
            <ShieldCheck className="size-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold">Document service is coming soon</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We are finishing secure payment verification and real PDF delivery before charging for
            generated documents. Your draft will not be treated as a completed paid document.
          </p>
        </div>
      </AppShell>
    );
  }

  return <DocumentsFlow fees={fees} />;
}
