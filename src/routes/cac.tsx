/**
 * Route: /cac
 *
 * CAC Business Name assistance remains visible as a coming-soon service until
 * real CAC filing, payment and status tracking are connected. Trust intro matches
 * approved UX: explain what you need before any form or payment.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, CheckCircle2, Clock3, Lock, ShieldCheck, Tag } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { CacRegistrationFlow } from "@/components/app/cac-registration-flow";
import { BRAND } from "@/lib/brand";
import { isBillLive } from "@/lib/product-mode";

export const Route = createFileRoute("/cac")({
  head: () => ({
    meta: [
      { title: `CAC Registration — ${BRAND.name}` },
      {
        name: "description",
        content:
          "CAC Business Name assistance will be available when production filing is connected.",
      },
    ],
  }),
  component: CacPage,
});

function CacPage() {
  if (!isBillLive("cac")) {
    return (
      <AppShell>
        <PageHeader title="CAC Registration" backTo="/services" />
        <div className="mx-auto max-w-md space-y-4 px-4 pb-8 pt-2">
          <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
            <div className="flex gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <Building2 className="size-5" />
              </span>
              <div>
                <h1 className="text-base font-semibold text-foreground">
                  Register your business with CAC
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Get your business name legally recognized. We will only accept payment when a real
                  filing connection is live.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              What you can register
            </p>
            <div className="mt-3 rounded-xl border border-primary/30 bg-primary-soft/40 px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Business Name</p>
                  <p className="text-xs text-muted-foreground">
                    Ideal for sole proprietors and startups (planned first product).
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-2 rounded-xl border border-border/70 px-3.5 py-3 opacity-70">
              <p className="text-sm font-medium text-muted-foreground">
                Company (Limited Liability)
              </p>
              <p className="text-xs text-muted-foreground">Coming later — not offered yet.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Before you start
            </p>
            <ul className="mt-3 space-y-2.5">
              {[
                "Applicant information",
                "Valid identification",
                "Business / address details",
                "Supporting documents",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-3 border-t border-border/60 pt-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock3 className="size-3.5" /> Estimated 15–20 min
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <Tag className="size-3.5 text-primary" /> From ₦27,500 when live
              </span>
            </div>
          </section>

          <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/40 px-4 py-4 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-primary-soft text-primary">
              <Lock className="size-4" />
            </span>
            <p className="mt-2 text-sm font-semibold text-foreground">Service is coming soon</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Payment and application submit stay locked until production CAC filing is connected.
              No simulated “submitted” status.
            </p>
            <Link
              to="/services"
              className="press mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm"
            >
              Browse other services
            </Link>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            We never mark CAC complete without a real filing path
          </p>
        </div>
      </AppShell>
    );
  }

  return <CacRegistrationFlow />;
}
