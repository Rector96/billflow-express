/**
 * Kill demo payBill fallback + short timeout.
 * node scripts/apply-kill-demo-pay.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function patchPaySlug() {
  const file = path.join(root, "src/routes/pay.$slug.tsx");
  let c = fs.readFileSync(file, "utf8");
  if (c.includes("This service is not available for live payment yet")) {
    console.log("pay.$slug already killed demo");
    return;
  }
  if (c.includes("Live provider call failed, processing via wallet ledger")) {
    const start = c.indexOf("      const reference = await payBill({");
    const catchLive = c.indexOf("Live provider call failed, processing via wallet ledger");
    if (start < 0 || catchLive < 0) throw new Error("demo markers missing");
    const finallyIdx = c.indexOf("} finally {", catchLive);
    if (finallyIdx < 0) throw new Error("finally missing");
    const replacement = `      throw new Error(
        "This service is not available for live payment yet. Please choose Airtime, Data, Electricity, or Cable TV.",
      );
    } catch (err) {
      console.error("[pay] provider payment failed", err);
      toast.error(friendlyError(err, "We couldn't complete this payment."));
      setStep("confirm");
    `;
    c = c.slice(0, start) + replacement + c.slice(finallyIdx);
  }
  c = c.replace(/withFastTimeout/g, "withProviderTimeout");
  c = c.replace(/timeoutMs = 2800/g, "timeoutMs = 60_000");
  c = c.replace(/,\s*2800\s*,/g, ", 60_000,");
  c = c.replace(
    "const { balance, payBill, saved, transactions, refresh, profile } = useApp();",
    "const { balance, saved, transactions, refresh, profile } = useApp();",
  );
  if (c.includes("function withFastTimeout")) {
    c = c.replace("function withFastTimeout", "function withProviderTimeout");
  }
  // Ensure 60s default on the helper signature
  c = c.replace(
    /function withProviderTimeout<T>\(promise: Promise<T>, timeoutMs = \d+\)/,
    "function withProviderTimeout<T>(promise: Promise<T>, timeoutMs = 60_000)",
  );
  fs.writeFileSync(file, c);
  console.log("patched pay.$slug.tsx");
}

function patchAppStore() {
  const file = path.join(root, "src/lib/app-store.tsx");
  let c = fs.readFileSync(file, "utf8");
  if (c.includes("Demo wallet payments are disabled")) {
    console.log("app-store already disabled");
    return;
  }
  const re =
    /payBill:\s*async\s*\(input\)\s*=>\s*\{[\s\S]*?return row\?\.internal_reference \?\? "";\s*\},/;
  if (!re.test(c)) throw new Error("payBill block not found");
  c = c.replace(
    re,
    `payBill: async (_input) => {
        throw new Error(
          "Demo wallet payments are disabled. Use Airtime, Data, Electricity, or Cable with live provider settlement.",
        );
      },`,
  );
  fs.writeFileSync(file, c);
  console.log("patched app-store.tsx");
}

function patchBillFunctions() {
  const file = path.join(root, "src/lib/bill.functions.ts");
  const content = `import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SecureBillInput = {
  service: string;
  provider: string;
  product?: string;
  amount: number;
  customerIdentifier: string;
  status: "successful" | "pending" | "failed";
  metadata?: Record<string, unknown>;
  pin: string;
};

export type SecureBillResult = {
  billId: string;
  internalReference: string;
  balanceAfter: number;
};

/**
 * Permanently disabled. Live payments must use VTpass server functions.
 */
export const secureBillPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SecureBillInput) => {
    const pin = String(input?.pin ?? "").trim();
    if (!/^[0-9]{4}$/.test(pin)) throw new Error("Enter a valid 4-digit PIN.");
    return input;
  })
  .handler(async (): Promise<SecureBillResult> => {
    throw new Error(
      "Demo secure_bill_payment is disabled. Use VTpass purchase server functions.",
    );
  });
`;
  fs.writeFileSync(file, content);
  console.log("wrote bill.functions.ts");
}

patchPaySlug();
patchAppStore();
patchBillFunctions();
console.log("OK — commit and push");
