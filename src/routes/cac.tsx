/**
 * Route: /cac — opens CacRegistrationFlow when hub preview is on (default).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Clock3, Tag } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { CacRegistrationFlow } from "@/components/app/cac-registration-flow";
import { BRAND } from "@/lib/brand";
import { isHubDemoOnly, isServiceFlowOpen } from "@/lib/product-mode";

export const Route = createFileRoute("/cac")({
  head: () => ({
    meta: [
      { title: `CAC Registration — ${BRAND.name}` },
      { name: "description", content: "CAC Business Name registration on RockPay." },
    ],
  }),
  component: CacPage,
});

function CacPage() {
  if (isServiceFlowOpen("cac")) {
    return (
      <>
        {isHubDemoOnly("cac") ? (
          <p className="mx-4 mt-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-center text-[10px] font-medium text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/50 dark:text-amber-100">
            Demo · no real CAC filing yet
          </p>
        ) : null}
        <CacRegistrationFlow />
      </>
    );
  }

  return (
    <AppShell>
      <PageHeader title="CAC Registration" backTo="/services" />
      <div className="mx-auto max-w-md space-y-3 px-4 pb-8 pt-2">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <Building2 className="size-5" />
            </span>
            <div>
              <h1 className="text-base font-bold">Business Name</h1>
              <p className="text-xs text-muted-foreground">Coming when filing is live</p>
            </div>
          </div>
          <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" /> 15–20 min
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Tag className="size-3 text-primary" /> ₦27,500
            </span>
          </div>
        </div>
        <Link
          to="/services"
          className="press inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
        >
          Back to services
        </Link>
      </div>
    </AppShell>
  );
}
