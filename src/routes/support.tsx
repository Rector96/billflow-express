import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, FileQuestion, TriangleAlert, Mail } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: `Support — ${BRAND.name}` },
      { name: "description", content: "Chat with support, read FAQs or report a transaction." },
      { property: "og:title", content: `Support — ${BRAND.name}` },
      { property: "og:description", content: "We're here to help, 24/7." },
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
    a: "Open the transaction from your history and tap Report Problem. Tokens are re-issued within an hour.",
  },
  {
    q: "How do I fund my wallet?",
    a: "Go to Wallet, tap Fund Wallet, choose an amount and continue. In this demo the payment is simulated.",
  },
];

function SupportPage() {
  return (
    <AppShell>
      <PageHeader title="Support" backTo="/profile" />
      <div className="space-y-6 px-4 pt-2 pb-6">
        <div>
          <h2 className="text-xl font-extrabold">How can we help?</h2>
          <p className="text-sm text-muted-foreground">
            Our team replies within 24 hours, every day of the week.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card
            Icon={MessageCircle}
            title="Contact Support"
            body="Start a live chat"
            onClick={() => toast.info("Live chat is coming soon")}
          />
          <Card
            Icon={Mail}
            title="Email Support"
            body={BRAND.supportEmail}
            onClick={() => toast.info(`Email us at ${BRAND.supportEmail}`)}
          />
          <Link
            to="/history"
            className="press flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-card"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-warning-soft text-warning-foreground">
              <TriangleAlert className="size-5" />
            </span>
            <span className="text-sm font-bold">Report Transaction</span>
            <span className="text-xs text-muted-foreground">Pick a transaction to report</span>
          </Link>
          <Card
            Icon={FileQuestion}
            title="FAQs"
            body="Answers to common questions"
            onClick={() => toast.info("Scroll down for FAQs")}
          />
        </div>

        <section>
          <h3 className="mb-2 text-sm font-bold">Frequently asked</h3>
          <Accordion type="single" collapsible className="rounded-2xl border bg-card px-4 shadow-card">
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
      className="press flex flex-col gap-2 rounded-2xl border bg-card p-4 text-left shadow-card"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-5" />
      </span>
      <span className="text-sm font-bold">{title}</span>
      <span className="truncate text-xs text-muted-foreground">{body}</span>
    </button>
  );
}
