
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPaystackSecret } from "./paystack.server";

describe("getPaystackSecret", () => {
  const originalMode = process.env["PAYSTACK_MODE"];
  const originalKey = process.env["PAYSTACK_SECRET_KEY"];

  function restoreEnvironment() {
    if (originalMode === undefined) {
      delete process.env["PAYSTACK_MODE"];
    } else {
      process.env["PAYSTACK_MODE"] = originalMode;
    }

    if (originalKey === undefined) {
      delete process.env["PAYSTACK_SECRET_KEY"];
    } else {
      process.env["PAYSTACK_SECRET_KEY"] = originalKey;
    }
  }

  it("rejects a missing secret key", () => {
    try {
      delete process.env["PAYSTACK_MODE"];
      delete process.env["PAYSTACK_SECRET_KEY"];

      assert.throws(
        () => getPaystackSecret(),
        /Paystack is not configured/,
      );
    } finally {
      restoreEnvironment();
    }
  });

  it("accepts a test key by default", () => {
    try {
      delete process.env["PAYSTACK_MODE"];
      process.env["PAYSTACK_SECRET_KEY"] = "sk_test_fake_key_for_testing";

      assert.equal(
        getPaystackSecret(),
        "sk_test_fake_key_for_testing",
      );
    } finally {
      restoreEnvironment();
    }
  });

  it("rejects a live key in test mode", () => {
    try {
      process.env["PAYSTACK_MODE"] = "test";
      process.env["PAYSTACK_SECRET_KEY"] = "sk_live_fake_key_for_testing";

      assert.throws(
        () => getPaystackSecret(),
        /test secret key is required/,
      );
    } finally {
      restoreEnvironment();
    }
  });

  it("rejects a test key in live mode", () => {
    try {
      process.env["PAYSTACK_MODE"] = "live";
      process.env["PAYSTACK_SECRET_KEY"] = "sk_test_fake_key_for_testing";

      assert.throws(
        () => getPaystackSecret(),
        /live secret key is required/,
      );
    } finally {
      restoreEnvironment();
    }
  });

  it("rejects an invalid payment mode", () => {
    try {
      process.env["PAYSTACK_MODE"] = "production";
      process.env["PAYSTACK_SECRET_KEY"] = "sk_test_fake_key_for_testing";

      assert.throws(
        () => getPaystackSecret(),
        /Invalid PAYSTACK_MODE/,
      );
    } finally {
      restoreEnvironment();
    }
  });
});