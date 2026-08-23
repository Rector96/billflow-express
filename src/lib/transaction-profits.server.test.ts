import { describe, expect, test } from "bun:test";
import {
  shouldRecordProfit,
  computeProfit,
} from "./transaction-profits.server";

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

  test("customer_amount - provider_cost when known", () => {
    expect(computeProfit(510, 500)).toBe(10);
    expect(computeProfit(10500, 10000)).toBe(500);
  });

  test("never treat rockpay_fee alone as profit", () => {
    expect(computeProfit(510, null)).toBeNull();
  });
});

describe("requery → successful semantics", () => {
  test("same helper gate applies after requery settlement", () => {
    expect(shouldRecordProfit("successful")).toBe(true);
    expect(shouldRecordProfit("pending")).toBe(false);
    expect(shouldRecordProfit("failed")).toBe(false);
  });
});
