import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/app/app-shell";
import { LegalTermsContent } from "@/components/app/legal-terms-content";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: `Terms & Conditions — ${BRAND.name}` }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl pb-8">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-8">
        <Link to="/signup" aria-label={`Back to ${BRAND.name}`}>
          <BrandLogo className="h-12" />
        </Link>
        <Link to="/privacy" className="text-sm font-bold text-primary">
          Privacy
        </Link>
      </header>
      <LegalTermsContent />
    </main>
  );
}
