import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyPaystackFunding } from "./paystack.server";

describe("classifyPaystackFunding", () => {
  const base = {
    id: 6710270882,
    domain: "test",
    status: "success",
    reference: "WAL-5D039ED5",
    currency: "NGN",
  };

  it("accepts an exact-amount successful transaction", () => {
    const result = classifyPaystackFunding(
      { ...base, amount: 500000, requested_amount: 500000, fees: 0 },
      "WAL-5D039ED5",
      500000,
    );
    assert.equal(result.kind, "standard");
  });

  it("recognizes a fee-inclusive bank-transfer charge only when all amounts reconcile", () => {
    const result = classifyPaystackFunding(
      { ...base, amount: 517767, requested_amount: 500000, fees: 17767 },
      "WAL-5D039ED5",
      500000,
    );
    assert.deepEqual(result, {
      kind: "fee_inclusive",
      providerTransactionId: "6710270882",
      requestedSubunits: 500000,
      chargedSubunits: 517767,
      feeSubunits: 17767,
    });
  });

  it("rejects an unexplained difference between charged amount and requested amount", () => {
    const result = classifyPaystackFunding(
      { ...base, amount: 517767, requested_amount: 500000, fees: 10000 },
      "WAL-5D039ED5",
      500000,
    );
    assert.deepEqual(result, { kind: "mismatch", reason: "amount_mismatch" });
  });

  it("rejects a different reference", () => {
    const result = classifyPaystackFunding(
      { ...base, amount: 500000 },
      "WAL-OTHER",
      500000,
    );
    assert.deepEqual(result, { kind: "mismatch", reason: "reference_mismatch" });
  });

  it("rejects a non-NGN transaction", () => {
    const result = classifyPaystackFunding(
      { ...base, amount: 500000, currency: "USD" },
      "WAL-5D039ED5",
      500000,
    );
    assert.deepEqual(result, { kind: "mismatch", reason: "currency_mismatch" });
  });

  it("rejects a successful response without a provider transaction id", () => {
    const result = classifyPaystackFunding(
      { ...base, id: undefined, amount: 500000 },
      "WAL-5D039ED5",
      500000,
    );
    assert.deepEqual(result, { kind: "mismatch", reason: "missing_provider_transaction_id" });
  });
});
