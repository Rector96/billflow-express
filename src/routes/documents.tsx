/**
 * Route: /documents
 * Business Constitution & Tenancy Agreement generator (demo).
 * See docs/TIN_AND_DOCUMENTS.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { DocumentsFlow } from "@/components/app/documents-flow";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: `Documents — ${BRAND.name}` },
      {
        name: "description",
        content: "Generate business constitution or tenancy agreement drafts. Demo mode until connected.",
      },
    ],
  }),
  component: DocumentsFlow,
});
