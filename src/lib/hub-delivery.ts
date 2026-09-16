/**
 * Shared delivery choice for hub products (CAC, NIN card, later sticker/docs).
 * Download = digital only. Deliver = physical + courier fee + address required.
 */
export type DeliveryMethod = "download" | "deliver";

export type DeliveryAddress = {
  phone: string;
  street: string;
  area: string;
  lga: string;
  state: string;
};

export const EMPTY_DELIVERY_ADDRESS: DeliveryAddress = {
  phone: "",
  street: "",
  area: "",
  lga: "",
  state: "Lagos",
};

/** Default courier add-on when pricing_rules has no nin_courier / cac_courier row */
export const DEFAULT_COURIER_FEE = 1_500;
export const DEFAULT_CAC_PRINT_PACK_FEE = 2_500;

export function formatDeliveryOneLine(a: DeliveryAddress): string {
  return [a.street, a.area, a.lga, a.state, a.phone].filter(Boolean).join(", ");
}

export function validateDeliveryAddress(a: DeliveryAddress): string | null {
  if (a.phone.replace(/\D/g, "").length < 10) return "Enter a valid phone number.";
  if (a.street.trim().length < 5) return "Enter street address.";
  if (a.lga.trim().length < 2) return "Enter LGA.";
  if (!a.state.trim()) return "Select state.";
  return null;
}

export const NG_DELIVERY_STATES = [
  "Lagos",
  "Abuja (FCT)",
  "Rivers",
  "Kano",
  "Oyo",
  "Ogun",
  "Kaduna",
  "Delta",
  "Anambra",
  "Enugu",
  "Other",
] as const;
