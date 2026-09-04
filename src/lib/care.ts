/** RockPay Care shared helpers — UI only, no money logic. */

export type TicketStatus = "open" | "in_progress" | "waiting_for_customer" | "resolved" | "closed";

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

export const CATEGORY_OPTIONS: Array<{ key: TicketCategory; label: string; studentHint?: string }> = [
  { key: "payment_not_received", label: "Payment", studentHint: "Airtime/data not credited" },
  { key: "wrong_amount", label: "Wallet", studentHint: "Balance or funding issue" },
  { key: "pending_transaction", label: "Airtime & Data", studentHint: "Stuck or pending top-up" },
  { key: "token_not_received", label: "Token / PIN", studentHint: "Electricity token or exam PIN" },
  { key: "other", label: "Other", studentHint: "Account, login, or something else" },
];

/** Issue chips when a transaction is attached */
export const TX_ISSUE_OPTIONS: Array<{ reason: string; category: TicketCategory; label: string }> = [
  {
    reason: "not_received",
    category: "payment_not_received",
    label: "I didn't receive the service",
  },
  { reason: "wallet_debited", category: "wrong_amount", label: "My wallet was debited" },
  {
    reason: "taking_too_long",
    category: "pending_transaction",
    label: "Payment is taking too long",
  },
  { reason: "wrong_details", category: "other", label: "Wrong details" },
  { reason: "token_missing", category: "token_not_received", label: "I need a token / receipt" },
  { reason: "something_else", category: "other", label: "Something else" },
];

/** Self-serve FAQ — deflects tickets when the answer is already known */
export type CareFaq = {
  id: string;
  q: string;
  a: string;
  tags: string[];
};

export const CARE_FAQ: CareFaq[] = [
  {
    id: "pending",
    q: "My airtime or data is still pending",
    a: "Pending usually means the network is still processing. Wait up to 15 minutes, then check History. If it stays pending, open Care from that transaction — we can requery the provider without you retyping details.",
    tags: ["pending", "airtime", "data"],
  },
  {
    id: "funding",
    q: "I paid with Paystack but wallet is not up",
    a: "Wallet is credited only after Paystack confirms on our server. Open Wallet → Fund and use Refresh status if you returned from checkout. Never pay twice for the same attempt — use the same reference in Care if it stays pending after 10 minutes.",
    tags: ["wallet", "paystack", "funding"],
  },
  {
    id: "token",
    q: "I paid electricity but no token",
    a: "Successful electricity payments show the token on the receipt in History. If status is successful but token is missing, open Care from that payment and choose “I need a token / receipt”.",
    tags: ["electricity", "token"],
  },
  {
    id: "exam",
    q: "WAEC / JAMB / NABTEB PIN",
    a: "Exam PINs appear on the success screen and in History when the vendor delivers them. If purchase is not enabled yet, the app will say VTUAfrica is pending activation — no wallet debit happens until the API is live.",
    tags: ["exam", "waec", "jamb", "nabteb"],
  },
  {
    id: "wrong-number",
    q: "I sent airtime to the wrong number",
    a: "Once the network delivers airtime, it usually cannot be reversed. Double-check the number before confirm. If the payment failed, your wallet is refunded automatically.",
    tags: ["airtime", "wrong"],
  },
];

/** Staff canned replies — speed + consistent tone (AI can replace these later) */
export const STAFF_QUICK_REPLIES: Array<{ id: string; label: string; body: string }> = [
  {
    id: "looking",
    label: "We're looking into it",
    body: "Thanks for reaching out. We're checking this payment with the provider now. We'll update you as soon as we have a clear status.",
  },
  {
    id: "need-ref",
    label: "Need more info",
    body: "Please reply with: (1) the phone/meter/account number used, (2) approximate time of payment, and (3) a screenshot if you have one. That helps us resolve this faster.",
  },
  {
    id: "requery",
    label: "Requery in progress",
    body: "We've sent a status check to the provider. This can take a few minutes. Your money stays protected — if the service failed, a refund follows the provider response.",
  },
  {
    id: "resolved-ok",
    label: "Resolved — delivered",
    body: "Good news: the provider confirms delivery. Please check your phone/meter and History receipt. If anything still looks wrong, reply on this thread within 24 hours.",
  },
  {
    id: "resolved-refund",
    label: "Resolved — refunded",
    body: "This payment did not complete on the provider side. Your wallet has been (or will be) refunded. Please refresh your balance. Sorry for the wait — thanks for your patience.",
  },
  {
    id: "closed-polite",
    label: "Closing as resolved",
    body: "We're marking this request resolved. If the issue continues, open a new Care request from the same payment in History and we'll pick it up again.",
  },
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

/** Suggested next status after a quick reply (ops workflow) */
export function suggestedStatusAfterQuickReply(quickId: string): TicketStatus | null {
  if (quickId === "need-ref") return "waiting_for_customer";
  if (quickId === "looking" || quickId === "requery") return "in_progress";
  if (quickId === "resolved-ok" || quickId === "resolved-refund" || quickId === "closed-polite") {
    return "resolved";
  }
  return null;
}
