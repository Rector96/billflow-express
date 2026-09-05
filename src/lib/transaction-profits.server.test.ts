import { describe, expect, test } from "bun:test";
import {
  shouldRecordProfit,
  computeProfit,
  sanitizeBackfillMoney,
  planNullOnlyBackfill,
} from "./transaction-profits.server";
import { parseVtpassMoney } from "./vtpass.server";

describe("shouldRecordProfit", () => {
  test("records only on successful", () => {
    expect(shouldRecordProfit("successful")).toBe(true);
  });

  test("does not record failed/pending/ambiguous", () => {
    expect(shouldRecordProfit("failed")).toBe(false);
    expect(shouldRecordProfit("pending")).toBe(false);
    expect(shouldRecordProfit("ambiguous")).toBe(false);
    expect(shouldRecordProfit(null)).toBe(false);
    expect(shouldRecordProfit(undefined)).toBe(false);
    expect(shouldRecordProfit("")).toBe(false);
  });
});

describe("computeProfit", () => {
  test("null when provider_cost unknown (do not invent)", () => {
    expect(computeProfit(510, null)).toBeNull();
    expect(computeProfit(510, undefined)).toBeNull();
  });

  test("customer_amount - provider_cost when known (gross profit)", () => {
    expect(computeProfit(510, 500)).toBe(10);
    expect(computeProfit(10500, 10000)).toBe(500);
    expect(computeProfit(1000, 970)).toBe(30);
  });

  test("never treat rockpay_fee alone as profit", () => {
    expect(computeProfit(510, null)).toBeNull();
  });
});

describe("parseVtpassMoney", () => {
  test("parses numbers and numeric strings", () => {
    expect(parseVtpassMoney(97.5)).toBe(97.5);
    expect(parseVtpassMoney("97.50")).toBe(97.5);
    expect(parseVtpassMoney("1,000.25")).toBe(1000.25);
  });

  test("null for missing/invalid", () => {
    expect(parseVtpassMoney(null)).toBeNull();
    expect(parseVtpassMoney(undefined)).toBeNull();
    expect(parseVtpassMoney("")).toBeNull();
    expect(parseVtpassMoney("abc")).toBeNull();
  });
});

describe("requery → successful semantics", () => {
  test("same helper gate applies after requery settlement", () => {
    expect(shouldRecordProfit("successful")).toBe(true);
    expect(shouldRecordProfit("pending")).toBe(false);
    expect(shouldRecordProfit("failed")).toBe(false);
  });
});

describe("sanitizeBackfillMoney", () => {
  test("null inputs do not invent values", () => {
    expect(sanitizeBackfillMoney(null)).toBeNull();
    expect(sanitizeBackfillMoney(undefined)).toBeNull();
    expect(sanitizeBackfillMoney("")).toBeNull();
    expect(sanitizeBackfillMoney("abc")).toBeNull();
    expect(sanitizeBackfillMoney(NaN)).toBeNull();
    expect(sanitizeBackfillMoney(-1)).toBeNull();
  });

  test("accepts finite non-negative money", () => {
    expect(sanitizeBackfillMoney(96)).toBe(96);
    expect(sanitizeBackfillMoney("96.5")).toBe(96.5);
    expect(sanitizeBackfillMoney(0)).toBe(0);
  });
});

describe("planNullOnlyBackfill (NULL-only repair rules)", () => {
  test("successful repair fills NULL provider_cost and calculates profit", () => {
    const plan = planNullOnlyBackfill({
      existingCost: null,
      existingCommission: null,
      existingProfit: null,
      customerAmount: 100,
      suppliedCost: 96,
      suppliedCommission: 4,
    });
    expect(plan.nextCost).toBe(96);
    expect(plan.nextCommission).toBe(4);
    expect(plan.nextProfit).toBe(4);
    expect(plan.wouldUpdate).toBe(true);
  });

  test("fill NULL provider_cost only", () => {
    const plan = planNullOnlyBackfill({
      existingCost: null,
      existingCommission: 4,
      existingProfit: null,
      customerAmount: 100,
      suppliedCost: 96,
      suppliedCommission: 99,
    });
    expect(plan.nextCost).toBe(96);
    expect(plan.nextCommission).toBe(4);
    expect(plan.nextProfit).toBe(4);
  });

  test("fill NULL provider_commission only", () => {
    const plan = planNullOnlyBackfill({
      existingCost: 96,
      existingCommission: null,
      existingProfit: 4,
      customerAmount: 100,
      suppliedCost: 1,
      suppliedCommission: 4,
    });
    expect(plan.nextCost).toBe(96);
    expect(plan.nextCommission).toBe(4);
    expect(plan.nextProfit).toBe(4);
  });

  test("calculate profit only when provider cost exists", () => {
    const noCost = planNullOnlyBackfill({
      existingCost: null,
      existingCommission: null,
      existingProfit: null,
      customerAmount: 100,
      suppliedCost: null,
      suppliedCommission: 4,
    });
    expect(noCost.nextCost).toBeNull();
    expect(noCost.nextCommission).toBe(4);
    expect(noCost.nextProfit).toBeNull();
  });

  test("never overwrite non-NULL cost", () => {
    const plan = planNullOnlyBackfill({
      existingCost: 96,
      existingCommission: null,
      existingProfit: null,
      customerAmount: 100,
      suppliedCost: 50,
      suppliedCommission: 4,
    });
    expect(plan.nextCost).toBe(96);
  });

  test("never overwrite non-NULL commission", () => {
    const plan = planNullOnlyBackfill({
      existingCost: null,
      existingCommission: 3.5,
      existingProfit: null,
      customerAmount: 100,
      suppliedCost: 96.5,
      suppliedCommission: 9,
    });
    expect(plan.nextCommission).toBe(3.5);
  });

  test("never overwrite non-NULL profit", () => {
    const plan = planNullOnlyBackfill({
      existingCost: 96,
      existingCommission: 4,
      existingProfit: 999,
      customerAmount: 100,
      suppliedCost: 96,
      suppliedCommission: 4,
    });
    expect(plan.nextProfit).toBe(999);
    expect(plan.wouldUpdate).toBe(false);
  });

  test("repeated repair is idempotent when already complete", () => {
    const plan = planNullOnlyBackfill({
      existingCost: 96,
      existingCommission: 4,
      existingProfit: 4,
      customerAmount: 100,
      suppliedCost: 96,
      suppliedCommission: 4,
    });
    expect(plan.wouldUpdate).toBe(false);
  });

  test("Data sample: customer 100, cost 96, commission 4 → profit 4", () => {
    const plan = planNullOnlyBackfill({
      existingCost: null,
      existingCommission: null,
      existingProfit: null,
      customerAmount: 100,
      suppliedCost: 96,
      suppliedCommission: 4,
    });
    expect(plan.nextProfit).toBe(4);
  });
});
