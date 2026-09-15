/**
 * Server-side hub fees from public.pricing_rules.
 * Schema (real RockPay table):
 *   service, provider, product_code, markup_type, markup_value,
 *   min_amount, max_amount, is_active, priority
 * Hub catalog fees use markup_type = 'selling_price' (flat Naira fee).
 * SERVICE_PRICES remain fallback only.
 */
import { SERVICE_PRICES, type HubPriceKey } from "@/lib/hub-service-prices";

export type HubFeeMap = Record<string, number>;

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

/** Map a pricing_rules row to a flat hub fee (NGN). */
function feeFromRule(row: { markup_type?: string | null; markup_value?: number | null }): number {
  const type = String(row.markup_type ?? "").toLowerCase();
  const value = Number(row.markup_value ?? 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  // Hub products are sold as a fixed catalog price
  if (type === "selling_price" || type === "fixed") return Math.round(value);
  return 0;
}

export async function loadHubFeesFromSupabase(): Promise<HubFeeMap> {
  const fees: HubFeeMap = {};
  for (const slug of HUB_SLUGS) {
    fees[slug] = fallbackFor(slug);
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Real columns — never fixed_fee / active
    const { data, error } = await supabaseAdmin
      .from("pricing_rules")
      .select("service, markup_type, markup_value, is_active, priority")
      .eq("is_active", true)
      .in("service", [...HUB_SLUGS]);

    if (error) {
      console.warn("[hub-pricing.loader]", error.message);
      return fees;
    }

    // Prefer higher priority when multiple rows share a service
    const best = new Map<string, { fee: number; priority: number }>();
    for (const raw of data ?? []) {
      const row = raw as {
        service?: string;
        markup_type?: string;
        markup_value?: number;
        priority?: number;
      };
      const service = String(row.service ?? "")
        .trim()
        .toLowerCase();
      if (!service) continue;
      const fee = feeFromRule(row);
      if (fee <= 0) continue;
      const pri = Number(row.priority) || 0;
      const prev = best.get(service);
      if (!prev || pri >= prev.priority) best.set(service, { fee, priority: pri });
    }
    for (const [service, { fee }] of best) {
      fees[service] = fee;
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
