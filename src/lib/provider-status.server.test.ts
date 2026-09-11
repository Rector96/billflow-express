import { describe, expect, test } from "vitest";
import { parseVtuafricaResult } from "./vtuafrica.server";
import { shouldFailoverVtpass } from "./vendor-router.server";

describe("VTUAfrica status normalization", () => {
  test("keeps processing responses pending", () => {
    const result = parseVtuafricaResult(
      { code: "200", description: { Status: "Processing", message: "Queued" } },
      "VA-1",
    );
    expect(result.status).toBe("pending");
    expect(result.ok).toBe(false);
  });

  test("only treats explicit delivery as successful", () => {
    const result = parseVtuafricaResult(
      { code: "101", description: { Status: "Completed", message: "Delivered" } },
      "VA-2",
    );
    expect(result.status).toBe("successful");
    expect(result.ok).toBe(true);
  });

  test("does not mistake 'not successful' for success", () => {
    const result = parseVtuafricaResult(
      { code: "400", description: { Status: "Failed", message: "Not successful" } },
      "VA-3",
    );
    expect(result.status).toBe("failed");
    expect(result.ok).toBe(false);
  });
});

describe("VTpass fallback eligibility", () => {
  test("does not fail over terminal customer failures", () => {
    expect(
      shouldFailoverVtpass({
        code: "021",
        responseDescription: "Invalid customer number",
        requestId: "REQ-1",
        transactionId: null,
        contentStatus: "failed",
        purchasedCode: null,
        raw: {},
      }),
    ).toBe(false);
  });

  test("fails over explicit provider availability failures", () => {
    expect(
      shouldFailoverVtpass({
        code: "034",
        responseDescription: "Service unavailable",
        requestId: "REQ-2",
        transactionId: null,
        contentStatus: "failed",
        purchasedCode: null,
        raw: {},
      }),
    ).toBe(true);
  });
});
