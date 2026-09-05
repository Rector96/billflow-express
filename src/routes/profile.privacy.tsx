import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/app-shell";
import { LegalPrivacyContent } from "@/components/app/legal-privacy-content";
import { PageHeader } from "@/components/app/page-header";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/profile/privacy")({
  head: () => ({ meta: [{ title: `Privacy Policy — ${BRAND.name}` }] }),
  component: ProfilePrivacyPage,
});

function ProfilePrivacyPage() {
  return (
    <AppShell>
      <PageHeader title="Privacy Policy" backTo="/profile" />
      <LegalPrivacyContent />
    </AppShell>
  );
}
