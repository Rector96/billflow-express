/**
 * Phase 9 production-readiness contracts.
 *
 * These tests intentionally stay provider-independent. They exercise the parts of
 * the payment safety model that can be verified without making real-money or
 * real-provider requests.
 */
import { describe, expect, test } from "bun:test";
import { applyPricingRule, selectMatchingRule, type PricingRuleRow } from "./pricing.server";

type RuleInput = Partial<PricingRuleRow> &
  Pick<PricingRuleRow, "id" | "markup_type" | "markup_value">;

function rule(partial: RuleInput): PricingRuleRow {
  return {
    service: "airtime",
    provider: null,
    product_code: null,
    min_amount: null,
    max_amount: null,
    is_active: true,
    priority: 0,
    ...partial,
  };
}

describe("Phase 9 — pricing safety", () => {
  test("missing rule is safe fallback with zero RockPay fee", () => {
    const result = applyPricingRule({ service: "airtime", provider: "mtn", baseAmount: 500 }, []);

    expect(result.usedFallback).toBe(true);
    expect(result.baseAmount).toBe(500);
    expect(result.customerAmount).toBe(500);
    expect(result.rockpayFee).toBe(0);
    expect(result.pricingRuleId).toBeNull();
  });

  test("active rule can never reduce the customer price below provider base", () => {
    const result = applyPricingRule({ service: "airtime", provider: "mtn", baseAmount: 500 }, [
      rule({
        id: "floor",
        service: "airtime",
        provider: "mtn",
        markup_type: "selling_price",
        markup_value: 1,
      }),
    ]);

    expect(result.customerAmount).toBe(500);
    expect(result.rockpayFee).toBe(0);
  });

  test("product-specific pricing remains more specific than provider pricing", () => {
    const selected = selectMatchingRule(
      [
        rule({
          id: "provider",
          service: "data",
          provider: "mtn-data",
          markup_type: "fixed",
          markup_value: 20,
          priority: 100,
        }),
        rule({
          id: "product",
          service: "data",
          provider: "mtn-data",
          product_code: "mtn-1gb",
          markup_type: "fixed",
          markup_value: 5,
          priority: 0,
        }),
      ],
      "data",
      "mtn-data",
      "mtn-1gb",
    );

    expect(selected?.id).toBe("product");
  });

  test("inactive pricing cannot affect a transaction", () => {
    const result = applyPricingRule(
      { service: "data", provider: "mtn-data", productCode: "mtn-1gb", baseAmount: 300 },
      [
        rule({
          id: "inactive",
          service: "data",
          provider: "mtn-data",
          product_code: "mtn-1gb",
          markup_type: "fixed",
          markup_value: 100,
          is_active: false,
        }),
      ],
    );

    expect(result.usedFallback).toBe(true);
    expect(result.customerAmount).toBe(300);
  });
});

describe("Phase 9 — amount validation", () => {
  test("negative customer/provider base is rejected before payment", () => {
    expect(() =>
      applyPricingRule({ service: "airtime", provider: "mtn", baseAmount: -1 }, []),
    ).toThrow();
  });

  test("non-finite provider/base amount is rejected", () => {
    expect(() =>
      applyPricingRule({ service: "airtime", provider: "mtn", baseAmount: Number.NaN }, []),
    ).toThrow();
    expect(() =>
      applyPricingRule(
        { service: "airtime", provider: "mtn", baseAmount: Number.POSITIVE_INFINITY },
        [],
      ),
    ).toThrow();
  });
});
