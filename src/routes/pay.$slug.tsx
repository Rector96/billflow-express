import { createFileRoute } from "@tanstack/react-router";
import { RockPayBillFlow } from "@/components/app/rockpay-bill-flow";
import { BRAND } from "@/lib/brand";
import { getService } from "@/lib/mock-data";

type Search = {
  saved?: string;
  provider?: string;
  amount?: number;
  identifier?: string;
};

export const Route = createFileRoute("/pay/$slug")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof s.saved === "string") out.saved = s.saved;
    if (typeof s.provider === "string") out.provider = s.provider;
    if (typeof s.identifier === "string") out.identifier = s.identifier;
    if (typeof s.amount === "number" && Number.isFinite(s.amount)) out.amount = s.amount;
    if (typeof s.amount === "string" && s.amount.trim()) {
      const amount = Number(s.amount);
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
  component: RockPayBillFlow,
});
