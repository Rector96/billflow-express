import { describe, expect, test } from "bun:test";
import { matchesPaystackFundingAmount } from "./paystack.server";

describe("Paystack wallet funding amount validation", () => {
  const expectedSubunits = 500_000;

  test("accepts an exact deposit amount", () => {
    expect(matchesPaystackFundingAmount({ expectedSubunits, actualSubunits: 500_000 })).toBe(true);
  });

  test("accepts fee pass-through only when requested amount and fee reconcile exactly", () => {
    expect(matchesPaystackFundingAmount({
      expectedSubunits,
      actualSubunits: 517_767,
      requestedSubunits: 500_000,
      feeSubunits: 17_767,
    })).toBe(true);
  });

  test("rejects a higher total without verified requested amount and fee", () => {
    expect(matchesPaystackFundingAmount({
      expectedSubunits,
      actualSubunits: 517_767,
    })).toBe(false);
  });

  test("rejects a fee that does not reconcile to the charged total", () => {
    expect(matchesPaystackFundingAmount({
      expectedSubunits,
      actualSubunits: 517_767,
      requestedSubunits: 500_000,
      feeSubunits: 17_766,
    })).toBe(false);
  });

  test("rejects a requested amount that differs from the wallet deposit", () => {
    expect(matchesPaystackFundingAmount({
      expectedSubunits,
      actualSubunits: 517_767,
      requestedSubunits: 499_000,
      feeSubunits: 18_767,
    })).toBe(false);
  });
});
