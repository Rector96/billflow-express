export type TicketCategory =
  "payment_not_received" | "wrong_amount" | "pending_transaction" | "token_not_received" | "other";

export const CATEGORY_OPTIONS: Array<{ key: TicketCategory; label: string }> = [
  { key: "payment_not_received", label: "Payment" },
  { key: "wrong_amount", label: "Wallet" },
  { key: "pending_transaction", label: "Bills & orders" },
  { key: "token_not_received", label: "Electricity" },
  { key: "other", label: "Other" },
];
