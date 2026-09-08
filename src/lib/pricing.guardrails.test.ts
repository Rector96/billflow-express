/**
 * Pricing guardrail tests.
 * These tests lock in the production rule that customer pricing must never
 * reduce the provider/base amount and that an absent rule is always safe.
 */
import { describe, expect, test } from "bun:test";
import { applyPricingRule, type PricingRuleRow } from "./pricing.server";

function rule(
  partial: Partial<PricingRuleRow> & Pick<PricingRuleRow, "id" | "markup_type" | "markup_value">,
): PricingRuleRow {
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

describe("production pricing guardrails", () => {
  test("fallback never adds an invented fee", () => {
    const result = applyPricingRule({ service: "airtime", provider: "mtn", baseAmount: 1000 }, []);

    expect(result.usedFallback).toBe(true);
    expect(result.customerAmount).toBe(1000);
    expect(result.rockpayFee).toBe(0);
  });

  test("customer amount cannot be below provider/base amount", () => {
    const result = applyPricingRule(
      { service: "data", provider: "mtn-data", productCode: "plan-1", baseAmount: 1000 },
      [
        rule({
          id: "selling-price-below-cost",
          service: "data",
          provider: "mtn-data",
          product_code: "plan-1",
          markup_type: "selling_price",
          markup_value: 900,
        }),
      ],
    );

    expect(result.customerAmount).toBe(1000);
    expect(result.rockpayFee).toBe(0);
  });

  test("inactive pricing rules cannot change the customer price", () => {
    const result = applyPricingRule(
      { service: "electricity", provider: "abuja-electric", baseAmount: 5000 },
      [
        rule({
          id: "inactive",
          service: "electricity",
          provider: "abuja-electric",
          markup_type: "fixed",
          markup_value: 500,
          is_active: false,
        }),
      ],
    );

    expect(result.usedFallback).toBe(true);
    expect(result.customerAmount).toBe(5000);
  });

  test("positive markup is isolated as RockPay fee", () => {
    const result = applyPricingRule({ service: "airtime", provider: "mtn", baseAmount: 1000 }, [
      rule({
        id: "verified-example",
        service: "airtime",
        provider: "mtn",
        markup_type: "fixed",
        markup_value: 10,
      }),
    ]);

    expect(result.customerAmount).toBe(1010);
    expect(result.rockpayFee).toBe(10);
    expect(result.customerAmount - 1000).toBe(result.rockpayFee);
  });
});
