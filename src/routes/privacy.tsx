import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPrivacyContent } from "@/components/app/legal-privacy-content";
import { BrandLogo } from "@/components/app/app-shell";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: `Privacy Policy — ${BRAND.name}` }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl pb-8">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-8">
        <Link to="/signup" aria-label={`Back to ${BRAND.name}`}>
          <BrandLogo className="h-12" />
        </Link>
        <Link to="/terms" className="text-sm font-bold text-primary">
          Terms
        </Link>
      </header>
      <LegalPrivacyContent />
    </main>
  );
}
