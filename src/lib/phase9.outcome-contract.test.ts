/**
 * Phase 9 provider-outcome contracts.
 *
 * These tests are provider-independent: they verify that raw VTpass outcomes
 * are mapped into the only three transaction states RockPay exposes.
 */
import { describe, expect, test } from "bun:test";
import { mapVtpassOutcome } from "./vtpass.server";

describe("Phase 9 — VTpass outcome safety", () => {
  test("VTpass success code 000 is successful even when content status is empty", () => {
    expect(
      mapVtpassOutcome({
        code: "000",
        contentStatus: "",
        responseDescription: "Transaction Successful",
      }),
    ).toBe("successful");
  });

  test("explicit successful content status is successful", () => {
    expect(
      mapVtpassOutcome({
        code: "",
        contentStatus: "delivered",
        responseDescription: "",
      }),
    ).toBe("successful");
  });

  test("known pending response remains pending", () => {
    expect(
      mapVtpassOutcome({
        code: "099",
        contentStatus: "",
        responseDescription: "Transaction is pending",
      }),
    ).toBe("pending");
  });

  test("unknown non-success response is not treated as successful", () => {
    expect(
      mapVtpassOutcome({
        code: "999",
        contentStatus: "",
        responseDescription: "Transaction failed",
      }),
    ).toBe("failed");
  });
});
