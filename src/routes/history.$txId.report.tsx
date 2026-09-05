import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { friendlyError, toTicketCategory, useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history/$txId/report")({
  head: () => ({
    meta: [
      { title: `Report a transaction — ${BRAND.name}` },
      { name: "description", content: "Tell us what went wrong and we'll investigate." },
      { property: "og:title", content: `Report a transaction — ${BRAND.name}` },
      { property: "og:description", content: "Our support team responds within 24 hours." },
    ],
  }),
  component: ReportPage,
});

const REASONS: Array<{ label: string; category: string; reason: string }> = [
  { label: "Payment not received", category: "payment_not_received", reason: "not_received" },
  { label: "Wrong amount", category: "wrong_amount", reason: "wrong_amount" },
  { label: "Transaction pending", category: "pending_transaction", reason: "taking_too_long" },
  { label: "Token not received", category: "token_not_received", reason: "token_missing" },
  { label: "Other", category: "other", reason: "something_else" },
];

function ReportPage() {
  const { txId } = Route.useParams();
  const navigate = useNavigate();
  const [reasonLabel, setReasonLabel] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [ticket, setTicket] = useState("");
  const { createSupportTicket } = useApp();

  const submit = async () => {
    const picked = REASONS.find((r) => r.label === reasonLabel);
    if (!picked) {
      toast.error("Choose what went wrong");
      return;
    }
    setSending(true);
    try {
      const id = await createSupportTicket({
        reference: txId,
        category: toTicketCategory(picked.category),
        reason: picked.reason,
        description: `${picked.label}${details.trim() ? ` — ${details.trim()}` : ""} (Transaction ${txId})`,
      });
      setTicket(`TKT-${id.slice(0, 8).toUpperCase()}`);
      setSubmitted(true);
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't submit your report."));
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <AppShell>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-10" />
          </span>
          <h1 className="text-2xl font-extrabold">Report Submitted</h1>
          <p className="text-sm text-muted-foreground">
            We've received your report. Ticket ID <span className="font-bold">{ticket}</span>. Our
            team will get back to you within 24 hours.
          </p>
          <Button
            className="mt-4 h-13 w-full max-w-sm rounded-2xl font-bold"
            onClick={() => navigate({ to: "/history/$txId", params: { txId } })}
          >
            Back to Transaction
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Report Problem" subtitle={txId} />
      <div className="space-y-5 px-4 pt-2 pb-6">
        <div className="space-y-2">
          <p className="text-sm font-bold">What went wrong?</p>
          {REASONS.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setReasonLabel(r.label)}
              className={cn(
                "press flex w-full items-center justify-between rounded-2xl border bg-card p-3.5 text-left text-sm font-semibold shadow-card",
                reasonLabel === r.label ? "border-primary bg-primary-soft text-primary" : "",
              )}
            >
              {r.label}
              <span
                className={cn(
                  "size-4 rounded-full border-2",
                  reasonLabel === r.label ? "border-primary bg-primary" : "border-border",
                )}
              />
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="details">Tell us what happened</Label>
          <Textarea
            id="details"
            rows={4}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Add any details that can help us resolve this faster"
            className="rounded-xl bg-card"
          />
        </div>

        <Button
          className="h-13 w-full rounded-2xl text-base font-bold"
          disabled={!reasonLabel || sending}
          onClick={() => void submit()}
        >
          {sending ? "Submitting…" : "Submit Report"}
        </Button>
      </div>
    </AppShell>
  );
}
