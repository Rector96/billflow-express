/**
 * Server-side hub fee map from Supabase `pricing_rules`.
 * Used by TanStack route loaders so UI prices update without a frontend rebuild.
 * SERVICE_PRICES remain fallback only.
 */
import { SERVICE_PRICES, type HubPriceKey } from "@/lib/hub-service-prices";

export type HubFeeMap = Record<string, number>;

/** Default courier handling fee when no pricing_rules row exists. */
export const NIN_COURIER_FEE_FALLBACK = 1_500;

const HUB_SLUGS = [
  "tin",
  "documents",
  "vehicle",
  "vehicle_license_sticker",
  "vehicle_third_party_insurance",
  "cac",
  "nin_retrieve",
  "nin_slip",
  "nin_card_print",
  "nin_plastic_card",
  "nin_courier",
] as const;

function fallbackFor(slug: string): number {
  const map: Record<string, HubPriceKey | number> = {
    tin: "tin_retrieve",
    documents: "document_generator",
    vehicle: "vehicle_renewal",
    vehicle_license_sticker: "vehicle_license_sticker",
    vehicle_third_party_insurance: "vehicle_third_party_insurance",
    cac: "cac_registration",
    nin_retrieve: "nin_retrieve",
    nin_slip: "nin_slip",
    nin_card_print: "nin_plastic_card",
    nin_plastic_card: "nin_plastic_card",
    nin_courier: NIN_COURIER_FEE_FALLBACK,
  };
  const key = map[slug];
  if (typeof key === "number") return key;
  if (key) return SERVICE_PRICES[key];
  return 0;
}

/**
 * Load active fixed fees for hub services. Safe if table/columns missing.
 */
export async function loadHubFeesFromSupabase(): Promise<HubFeeMap> {
  const fees: HubFeeMap = {};
  for (const slug of HUB_SLUGS) {
    fees[slug] = fallbackFor(slug);
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("pricing_rules")
      .select("service, fixed_fee, active")
      .eq("active", true)
      .in("service", [...HUB_SLUGS]);

    if (error) {
      console.warn("[hub-pricing.loader]", error.message);
      return fees;
    }

    for (const row of data ?? []) {
      const service = String((row as { service?: string }).service ?? "").trim().toLowerCase();
      const fixed = Number((row as { fixed_fee?: number | null }).fixed_fee ?? 0);
      if (service && Number.isFinite(fixed) && fixed > 0) {
        fees[service] = Math.round(fixed);
      }
    }
  } catch (e) {
    console.warn("[hub-pricing.loader] unavailable", e instanceof Error ? e.message : e);
  }

  return fees;
}

export function feeFromMap(fees: HubFeeMap, slug: string, fallback = 0): number {
  const v = fees[slug];
  if (typeof v === "number" && v > 0) return v;
  const fb = fallbackFor(slug);
  return fb > 0 ? fb : fallback;
}
