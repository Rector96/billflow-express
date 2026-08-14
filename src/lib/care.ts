/** RockPay Care shared helpers — UI only, no money logic. */

export type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_for_customer"
  | "resolved"
  | "closed";

export type TicketCategory =
  | "payment_not_received"
  | "wrong_amount"
  | "pending_transaction"
  | "token_not_received"
  | "other";

export const STATUS_LABEL: Record<TicketStatus, { label: string; hint: string }> = {
  open: { label: "Open", hint: "We've received your request." },
  in_progress: { label: "Investigating", hint: "Our team is checking this." },
  waiting_for_customer: { label: "Waiting for you", hint: "We need more information from you." },
  resolved: { label: "Resolved", hint: "We believe this issue has been resolved." },
  closed: { label: "Closed", hint: "This support request is closed." },
};

export const CATEGORY_OPTIONS: Array<{ key: TicketCategory; label: string }> = [
  { key: "payment_not_received", label: "Payment" },
  { key: "wrong_amount", label: "Wallet" },
  { key: "pending_transaction", label: "Airtime & Data" },
  { key: "token_not_received", label: "Electricity" },
  { key: "other", label: "Other" },
];

/** Issue chips when a transaction is attached */
export const TX_ISSUE_OPTIONS: Array<{ reason: string; category: TicketCategory; label: string }> = [
  { reason: "not_received", category: "payment_not_received", label: "I didn't receive the service" },
  { reason: "wallet_debited", category: "wrong_amount", label: "My wallet was debited" },
  { reason: "taking_too_long", category: "pending_transaction", label: "Payment is taking too long" },
  { reason: "wrong_details", category: "other", label: "Wrong details" },
  { reason: "token_missing", category: "token_not_received", label: "I need a token / receipt" },
  { reason: "something_else", category: "other", label: "Something else" },
];

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-primary-soft text-primary";
    case "in_progress":
      return "bg-warning-soft text-warning-foreground";
    case "waiting_for_customer":
      return "bg-warning-soft text-warning-foreground";
    case "resolved":
      return "bg-success-soft text-success";
    case "closed":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function formatTicketStatus(status: string): string {
  return STATUS_LABEL[status as TicketStatus]?.label ?? status.replace(/_/g, " ");
}
