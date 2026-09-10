import { createFileRoute } from "@tanstack/react-router";
import { RockPayBillEntry } from "@/components/app/rockpay-bill-entry";
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
  component: RockPayBillEntry,
});
