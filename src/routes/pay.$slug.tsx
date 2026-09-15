import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { RockPayBillEntry } from "@/components/app/rockpay-bill-entry";
import { BRAND } from "@/lib/brand";
import { getService } from "@/lib/mock-data";
import { isBillLive } from "@/lib/product-mode";

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
    if (typeof s["amount"] === "number" && Number.isFinite(s["amount"] as number)) out.amount = s["amount"] as number;
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
 * Defense-in-depth for direct URLs such as /pay/education.
 * The Services screen already labels unavailable services as "Soon", but a
 * customer can still enter any route manually. Never let that bypass the
 * centralized production-service gate.
 */
function PaySlugPage() {
  const { slug } = Route.useParams();

  if (!isBillLive(slug)) {
    const service = getService(slug);
    return (
      <AppShell>
        <PageHeader title={service?.name ?? "Service"} backTo="/services" />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
            <ShieldCheck className="size-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold">Service is coming soon</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This service is not currently enabled for customer payments. We will only open it after
            the provider and fulfillment path have been verified.
          </p>
        </div>
      </AppShell>
    );
  }

  return <RockPayBillEntry />;
}
