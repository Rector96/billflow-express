import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { RockPayBillEntry } from "@/components/app/rockpay-bill-entry";
import { BRAND } from "@/lib/brand";
import { getService } from "@/lib/mock-data";
import { isHubDemoOnly, isServiceFlowOpen, REMOVED_SERVICE_SLUGS } from "@/lib/product-mode";

type Search = {
  saved?: string;
  provider?: string;
  amount?: number;
  identifier?: string;
};

export const Route = createFileRoute("/pay/$slug")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof s["saved"] === "string") out.saved = s["saved"] as string;
    if (typeof s["provider"] === "string") out.provider = s["provider"] as string;
    if (typeof s["identifier"] === "string") out.identifier = s["identifier"] as string;
    if (typeof s["amount"] === "number" && Number.isFinite(s["amount"] as number))
      out.amount = s["amount"] as number;
    if (typeof s["amount"] === "string" && String(s["amount"]).trim()) {
      const amount = Number(s["amount"]);
      if (Number.isFinite(amount)) out.amount = amount;
    }
    return out;
  },
  head: ({ params }) => {
    const service = getService(params.slug);
    const name = service?.name ?? "Payment";
    return {
      meta: [
        { title: `Pay ${name} — ${BRAND.name}` },
        { name: "description", content: `Pay your ${name.toLowerCase()} bill in a few taps.` },
      ],
    };
  },
  component: PaySlugPage,
});

/**
 * Live bills: electricity, cable.
 * Demo hub flows on /pay: education, exam-pins (PIN quantity → confirm → result).
 * Removed: airtime, data.
 */
function PaySlugPage() {
  const { slug } = Route.useParams();
  const service = getService(slug);

  if (REMOVED_SERVICE_SLUGS.has(slug)) {
    return (
      <AppShell>
        <PageHeader title={service?.name ?? "Service"} backTo="/services" />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <ShieldCheck className="size-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold">Service not available</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This product is no longer offered on RockPay.
          </p>
        </div>
      </AppShell>
    );
  }

  if (!isServiceFlowOpen(slug)) {
    return (
      <AppShell>
        <PageHeader title={service?.name ?? "Service"} backTo="/services" />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
            <ShieldCheck className="size-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold">Service is coming soon</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We will open this when the provider path is verified end-to-end.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <>
      {isHubDemoOnly(slug) ? (
        <p className="mx-4 mt-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-center text-[10px] font-medium text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/50 dark:text-amber-100">
          Demo · exam/education flow for UX — not live VTpass purchase yet
        </p>
      ) : null}
      <RockPayBillEntry />
    </>
  );
}
