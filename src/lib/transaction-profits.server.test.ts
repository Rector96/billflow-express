import { describe, expect, test } from "bun:test";
import {
  shouldRecordProfit,
  computeProfit,
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
    // VTpass total_amount lower than face value (commission already netted by provider)
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
