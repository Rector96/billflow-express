/**
 * Shared hub fulfillment lifecycle (no courier API).
 * Soft copy can stop at digital_ready.
 * Hard copy continues: queued_print → sealed → dispatched → delivered.
 */

export const HUB_PAYMENT_STATUSES = ["pending", "in_progress", "successful", "failed"] as const;
export type HubPaymentStatus = (typeof HUB_PAYMENT_STATUSES)[number];

export const FULFILLMENT_STATUSES = [
  "looked_up",
  "paid",
  "digital_ready",
  "queued_print",
  "sealed",
  "dispatched",
  "delivered",
  "cancelled",
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  looked_up: "Looked up",
  paid: "Paid",
  digital_ready: "Digital ready",
  queued_print: "Queued for print",
  sealed: "Sealed / packed",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Map fulfillment step → coarse payment status on hub_orders.status */
export function paymentStatusForFulfillment(ful: FulfillmentStatus): HubPaymentStatus {
  if (ful === "cancelled") return "failed";
  if (ful === "digital_ready" || ful === "delivered") return "successful";
  if (ful === "looked_up" || ful === "paid") return "pending";
  return "in_progress";
}

export function isPhysicalService(service: string): boolean {
  const s = service.toLowerCase();
  return (
    s.includes("card_print") ||
    s.includes("plastic") ||
    s.includes("license_sticker") ||
    s.includes("vehicle_license") ||
    s.includes("cac") // CAC may be deliver
  );
}

export function initialFulfillmentForDelivery(delivery: "download" | "deliver"): FulfillmentStatus {
  return delivery === "deliver" ? "paid" : "paid";
}
