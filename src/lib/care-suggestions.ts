import type { TicketStatus } from "./care";

export type CareSuggestionInput = {
  category: string;
  status: string;
  description: string;
  transactionStatus?: string | null;
};

export function getCareReplySuggestions(input: CareSuggestionInput): string[] {
  const description = input.description.toLowerCase();
  const suggestions: string[] = [];
  const status = input.status as TicketStatus;

  if (input.category === "pending_transaction" || description.includes("pending")) {
    suggestions.push(
      "Thanks for contacting RockPay Care. Your transaction is still being confirmed by the provider. Your funds are protected, and we will update you as soon as the status changes.",
    );
  }
  if (input.category === "payment_not_received" || description.includes("not receive")) {
    suggestions.push(
      "We are checking the provider response for this transaction now. Please keep your reference available while we verify delivery and resolve this for you.",
    );
  }
  if (input.category === "wrong_amount" || description.includes("debited")) {
    suggestions.push(
      "We are reviewing the wallet debit against the transaction record. We will confirm the correct amount and refund any verified difference.",
    );
  }
  if (input.category === "token_not_received" || description.includes("token")) {
    suggestions.push(
      "We are checking the electricity provider response and token delivery. Please do not make another payment while we investigate this reference.",
    );
  }
  if (suggestions.length === 0) {
    suggestions.push(
      "Thanks for contacting RockPay Care. We have received your request and are reviewing the details. We will get back to you with the next update shortly.",
    );
  }
  if (status === "waiting_for_customer") {
    suggestions.push(
      "Please reply with the exact transaction reference and any error message shown in the app so we can continue.",
    );
  }
  if (input.transactionStatus === "successful") {
    suggestions.push(
      "Our records show this transaction as successful. Please confirm whether the service has now arrived, or tell us exactly what is still missing.",
    );
  }
  return suggestions.slice(0, 3);
}
