/**
 * Unit tests for the pure pricing engine.
 * Run with: bun test src/lib/pricing.server.test.ts
 */
import { describe, expect, test } from "bun:test";
import {
  applyPricingRule,
  computeFromRule,
  roundMoney,
  selectMatchingRule,
  type PricingRuleRow,
} from "./pricing.server";

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

describe("roundMoney", () => {
  test("rounds to 2 decimal places", () => {
    expect(roundMoney(10.125)).toBe(10.13);
    expect(roundMoney(10.124)).toBe(10.12);
    expect(roundMoney(500)).toBe(500);
  });
});

describe("no rule → base amount (fallback)", () => {
  test("empty rules list returns base unchanged", () => {
    const r = applyPricingRule({ service: "airtime", provider: "mtn", baseAmount: 500 }, []);
    expect(r.usedFallback).toBe(true);
    expect(r.customerAmount).toBe(500);
    expect(r.rockpayFee).toBe(0);
    expect(r.pricingRuleId).toBeNull();
  });
});

describe("fixed markup", () => {
  test("adds fixed naira amount", () => {
    const rules = [rule({ id: "f1", service: "airtime", markup_type: "fixed", markup_value: 10 })];
    const r = applyPricingRule({ service: "airtime", baseAmount: 500 }, rules);
    expect(r.usedFallback).toBe(false);
    expect(r.customerAmount).toBe(510);
    expect(r.rockpayFee).toBe(10);
    expect(r.markupType).toBe("fixed");
    expect(r.pricingRuleId).toBe("f1");
  });
});

describe("percentage markup", () => {
  test("adds percentage of base", () => {
    const rules = [
      rule({ id: "p1", service: "airtime", markup_type: "percentage", markup_value: 2 }),
    ];
    const r = applyPricingRule({ service: "airtime", baseAmount: 500 }, rules);
    expect(r.customerAmount).toBe(510);
    expect(r.rockpayFee).toBe(10);
  });
});

describe("selling_price", () => {
  test("forces exact customer price", () => {
    const rules = [
      rule({
        id: "s1",
        service: "data",
        provider: "mtn-data",
        product_code: "mtn-1gb",
        markup_type: "selling_price",
        markup_value: 350,
      }),
    ];
    const r = applyPricingRule(
      { service: "data", provider: "mtn-data", productCode: "mtn-1gb", baseAmount: 300 },
      rules,
    );
    expect(r.customerAmount).toBe(350);
    expect(r.rockpayFee).toBe(50);
    expect(r.markupType).toBe("selling_price");
  });
});

describe("specificity: product > provider > service", () => {
  test("product rule beats provider rule", () => {
    const rules = [
      rule({
        id: "prov",
        service: "data",
        provider: "mtn-data",
        markup_type: "fixed",
        markup_value: 20,
        priority: 100,
      }),
      rule({
        id: "prod",
        service: "data",
        provider: "mtn-data",
        product_code: "mtn-1gb",
        markup_type: "fixed",
        markup_value: 5,
        priority: 0,
      }),
    ];
    const r = applyPricingRule(
      { service: "data", provider: "mtn-data", productCode: "mtn-1gb", baseAmount: 300 },
      rules,
    );
    expect(r.pricingRuleId).toBe("prod");
    expect(r.customerAmount).toBe(305);
  });

  test("provider rule beats service rule", () => {
    const rules = [
      rule({ id: "svc", service: "airtime", markup_type: "fixed", markup_value: 50, priority: 99 }),
      rule({
        id: "prov",
        service: "airtime",
        provider: "mtn",
        markup_type: "fixed",
        markup_value: 10,
        priority: 0,
      }),
    ];
    const r = applyPricingRule({ service: "airtime", provider: "mtn", baseAmount: 500 }, rules);
    expect(r.pricingRuleId).toBe("prov");
    expect(r.customerAmount).toBe(510);
  });
});

describe("priority", () => {
  test("higher priority wins at same specificity", () => {
    const rules = [
      rule({ id: "low", service: "airtime", markup_type: "fixed", markup_value: 5, priority: 1 }),
      rule({
        id: "high",
        service: "airtime",
        markup_type: "fixed",
        markup_value: 15,
        priority: 10,
      }),
    ];
    const r = applyPricingRule({ service: "airtime", baseAmount: 100 }, rules);
    expect(r.pricingRuleId).toBe("high");
    expect(r.customerAmount).toBe(115);
  });
});

describe("inactive rule ignored", () => {
  test("inactive rules are skipped", () => {
    const rules = [
      rule({
        id: "off",
        service: "airtime",
        markup_type: "fixed",
        markup_value: 99,
        is_active: false,
        priority: 100,
      }),
    ];
    const r = applyPricingRule({ service: "airtime", baseAmount: 500 }, rules);
    expect(r.usedFallback).toBe(true);
    expect(r.customerAmount).toBe(500);
  });
});

describe("min / max", () => {
  test("min_amount floors the result", () => {
    const rules = [
      rule({
        id: "m1",
        service: "airtime",
        markup_type: "fixed",
        markup_value: 1,
        min_amount: 50,
      }),
    ];
    const r = applyPricingRule({ service: "airtime", baseAmount: 10 }, rules);
    expect(r.customerAmount).toBe(50);
  });

  test("max_amount caps the result", () => {
    const rules = [
      rule({
        id: "m2",
        service: "airtime",
        markup_type: "percentage",
        markup_value: 50,
        max_amount: 120,
      }),
    ];
    const r = applyPricingRule({ service: "airtime", baseAmount: 100 }, rules);
    expect(r.customerAmount).toBe(120);
  });
});

describe("invalid input rejected", () => {
  test("negative base amount throws", () => {
    expect(() => applyPricingRule({ service: "airtime", baseAmount: -1 }, [])).toThrow();
  });

  test("NaN base throws", () => {
    expect(() => applyPricingRule({ service: "airtime", baseAmount: Number.NaN }, [])).toThrow();
  });

  test("computeFromRule rejects negative markup value", () => {
    const bad = rule({
      id: "bad",
      markup_type: "fixed",
      markup_value: -5,
    });
    expect(() => computeFromRule(bad, 100)).toThrow();
  });
});

describe("selectMatchingRule", () => {
  test("returns null when nothing matches", () => {
    const rules = [rule({ id: "x", service: "cable", markup_type: "fixed", markup_value: 1 })];
    expect(selectMatchingRule(rules, "airtime", "mtn", null)).toBeNull();
  });
});

describe("electricity service pricing", () => {
  test("fixed fee on electricity base amount", () => {
    const rules = [
      rule({
        id: "e1",
        service: "electricity",
        provider: "ikeja-electric",
        markup_type: "fixed",
        markup_value: 50,
      }),
    ];
    const r = selectMatchingRule(rules, "electricity", "ikeja-electric", "prepaid");
    expect(r?.id).toBe("e1");
    const priced = computeFromRule(r!, 5000);
    expect(priced).toBe(5050);
  });
});
