import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolvePricing, type PricingService } from "./pricing.server";

export const quotePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    service: string;
    provider?: string | null;
    productCode?: string | null;
    baseAmount: number;
  }) => {
    const service = String(input?.service ?? "").trim().toLowerCase();
    if (!["airtime", "data", "cable", "electricity"].includes(service)) {
      throw new Error("Unsupported service for pricing.");
    }
    const baseAmount = Math.round(Number(input?.baseAmount));
    if (!Number.isFinite(baseAmount) || baseAmount < 0) {
      throw new Error("Invalid amount.");
    }
    return {
      service: service as PricingService,
      provider: input?.provider ? String(input.provider).trim() : null,
      productCode: input?.productCode ? String(input.productCode).trim() : null,
      baseAmount,
    };
  })
  .handler(async ({ data }) => {
    const pricing = await resolvePricing(data);
    return {
      baseAmount: pricing.baseAmount,
      customerAmount: pricing.customerAmount,
      rockpayFee: pricing.rockpayFee,
      pricingRuleId: pricing.pricingRuleId,
      usedFallback: pricing.usedFallback,
    };
  });
