import { createFileRoute } from "@tanstack/react-router";
import { PayFlow } from "@/components/app/pay-flow";
import { getService } from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";

type Search = {
  saved?: string | undefined;
  provider?: string | undefined;
  amount?: number | undefined;
  identifier?: string | undefined;
};

export const Route = createFileRoute("/pay/$slug")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof s["saved"] === "string") out.saved = s["saved"];
    if (typeof s["provider"] === "string") out.provider = s["provider"];
    if (typeof s["identifier"] === "string") out.identifier = s["identifier"];
    if (typeof s["amount"] === "number" && Number.isFinite(s["amount"])) out.amount = s["amount"] as number;
    if (typeof s["amount"] === "string" && s["amount"].trim() !== "") {
      const n = Number(s["amount"]);
      if (Number.isFinite(n)) out.amount = n;
    }
    return out;
  },
  head: ({ params }) => {
    const svc = getService(params.slug);
    const name = svc?.name ?? "Payment";
    return {
      meta: [
        { title: `Pay ${name} — ${BRAND.name}` },
        { name: "description", content: `Pay your ${name.toLowerCase()} bill in a few taps.` },
      ],
    };
  },
  component: PayFlow,
});
