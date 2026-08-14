import { createFileRoute, Link } from "@tanstack/react-router";
import { FileQuestion, HeartHandshake, Mail, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useApp } from "@/lib/app-store";
import { formatNaira } from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/support")({
  validateSearch: (s: Record<string, unknown>) => ({
    ...(typeof s["reference"] === "string" ? { reference: s["reference"] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: `RockPay Care — ${BRAND.name}` },
      { name: "description", content: "Get help with payments, wallet and account." },
      { property: "og:title", content: `RockPay Care — ${BRAND.name}` },
      { property: "og:description", content: "We're here to help." },
    ],
  }),
  component: SupportPage,
});

const FAQS = [
  {
    q: "How long does a payment take?",
    a: "Most payments complete instantly. Pending payments are usually confirmed within 15 minutes.",
  },
  {
    q: "I didn't receive my electricity token",
    a: "Open the transaction from History and use RockPay Care with that reference. We'll look it up from your receipt.",
  },
  {
    q: "How do I fund my wallet?",
    a: "Go to Wallet, tap Fund Wallet, choose an amount and continue with Paystack. Your wallet is credited only after payment is verified.",
  },
];

function SupportPage() {
  const { reference } = Route.useSearch();
  const { transactions } = useApp();
  const tx = reference ? transactions.find((t) => t.id === reference) : undefined;

  return (
    <AppShell>
      <PageHeader title="RockPay Care" backTo="/home" />
      <div className="space-y-6 px-4 pt-2 pb-6">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
            <HeartHandshake className="size-6" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">How can we help?</h2>
            <p className="text-sm text-muted-foreground">
              Payments, wallet and account support from {BRAND.name}.
            </p>
          </div>
        </div>

        {reference ? (
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              About this transaction
            </p>
            {tx ? (
              <div className="mt-2 space-y-1 text-sm">
                <p className="font-bold">{tx.title}</p>
                <p className="text-muted-foreground">{tx.service}</p>
                <p className="font-extrabold tabular-nums">{formatNaira(tx.amount, false)}</p>
                <p className="font-mono text-xs text-muted-foreground">{tx.id}</p>
                <p className="text-xs capitalize text-muted-foreground">Status: {tx.status}</p>
              </div>
            ) : (
              <p className="mt-2 font-mono text-xs text-muted-foreground">Reference {reference}</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Full ticket chat arrives in a later update. For now, email us with this reference or report from
              History.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Card
            Icon={Mail}
            title="Email Care"
            body={BRAND.supportEmail}
            onClick={() => toast.info(`Email us at ${BRAND.supportEmail}`)}
          />
          <Link
            to="/history"
            className="press flex flex-col gap-2 rounded-2xl border border-border/80 bg-card p-4 shadow-card"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-warning-soft text-warning-foreground">
              <TriangleAlert className="size-5" />
            </span>
            <span className="text-sm font-bold">Report a payment</span>
            <span className="text-xs text-muted-foreground">Open History and pick a receipt</span>
          </Link>
          <Card
            Icon={FileQuestion}
            title="FAQs"
            body="Common answers"
            onClick={() => toast.info("See FAQs below")}
          />
        </div>

        <section>
          <h3 className="mb-2 text-sm font-bold">Frequently asked</h3>
          <Accordion type="single" collapsible className="rounded-2xl border border-border/80 bg-card px-4 shadow-card">
            {FAQS.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left text-sm font-semibold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </div>
    </AppShell>
  );
}

function Card({
  Icon,
  title,
  body,
  onClick,
}: {
  Icon: typeof Mail;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex flex-col gap-2 rounded-2xl border border-border/80 bg-card p-4 text-left shadow-card"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-5" />
      </span>
      <span className="text-sm font-bold">{title}</span>
      <span className="truncate text-xs text-muted-foreground">{body}</span>
    </button>
  );
}
