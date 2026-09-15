/**
 * Configurable hub service prices (fallback when pricing_rules has no row).
 */
export const SERVICE_PRICES = {
  cac_registration: 27_500,
  nin_retrieve: 300,
  nin_slip: 500,
  nin_plastic_card: 2_500,
  tin_retrieve: 1_500,
  document_generator: 3_000,
  vehicle_renewal: 2_500,
  vehicle_license_sticker: 5_000,
  vehicle_third_party_insurance: 15_000,
} as const;

export type HubPriceKey = keyof typeof SERVICE_PRICES;

export function getHubPrice(key: HubPriceKey): number {
  return SERVICE_PRICES[key];
}
