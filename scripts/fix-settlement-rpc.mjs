/**
 * CRITICAL: authenticated cannot call complete_bill_purchase (revoked).
 * Settle via trusted_* + service_role so history status matches pay result.
 *
 * Run: node scripts/fix-settlement-rpc.mjs
 * Then commit src/lib/bills.functions.ts src/lib/airtime.functions.ts and push.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patchBills() {
  const file = path.join(root, "src/lib/bills.functions.ts");
  let c = fs.readFileSync(file, "utf8");
  if (c.includes("finalizeBillPurchase")) {
    console.log("bills already patched");
    return;
  }

  const helper = `
/** Settlement must use service_role — authenticated lost EXECUTE on complete_bill_purchase. */
async function finalizeBillPurchase(
  userId: string,
  internalReference: string,
  outcome: "successful" | "pending" | "failed",
  providerTransactionId: string,
  payload: Json,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin.rpc("trusted_complete_bill_purchase", {
    _user_id: userId,
    _internal_reference: internalReference,
    _outcome: outcome,
    _provider_transaction_id: providerTransactionId || "",
    _payload: payload,
  });
}

`;
  const anchor = "export const listVtpassServices";
  const ai = c.indexOf(anchor);
  if (ai < 0) throw new Error("listVtpassServices not found");
  c = c.slice(0, ai) + helper + c.slice(ai);

  const re =
    /await context\.supabase\.rpc\(\s*"complete_bill_purchase",\s*\{([\s\S]*?)\}\s*,?\s*\)/g;
  let n = 0;
  c = c.replace(re, (full, body) => {
    n++;
    const isBill = body.includes("bill.internal_reference");
    const ref = isBill
      ? "bill.internal_reference as string"
      : "row.internal_reference as string";
    const tx = isBill
      ? 'pay.transactionId ?? bill.provider_transaction_id ?? ""'
      : 'pay.transactionId ?? ""';
    const requery = body.includes("requery: true");
    const payload = requery
      ? `{\n        vtpass_code: pay.code,\n        vtpass_status: pay.contentStatus,\n        response_description: pay.responseDescription,\n        purchased_code: pay.purchasedCode,\n        vtpass_snapshot: safePayload(pay.raw),\n        requery: true,\n      }`
      : `{\n        vtpass_code: pay.code,\n        vtpass_status: pay.contentStatus,\n        response_description: pay.responseDescription,\n        purchased_code: pay.purchasedCode,\n        vtpass_snapshot: safePayload(pay.raw),\n      }`;
    return `await finalizeBillPurchase(\n      context.userId,\n      ${ref},\n      outcome,\n      ${tx},\n      ${payload},\n    )`;
  });
  console.log("bills complete_bill replacements", n);

  c = c.replace(
    /const status = \(fin\?\.status \?\? outcome\) as BillPurchaseResult\["status"\];/g,
    'const status = (fin?.status ?? "pending") as BillPurchaseResult["status"];',
  );

  fs.writeFileSync(file, c);
  console.log("wrote bills.functions.ts");
}

function patchAirtime() {
  const file = path.join(root, "src/lib/airtime.functions.ts");
  let c = fs.readFileSync(file, "utf8");
  if (c.includes("finalizeAirtimePurchase") && !c.includes('"complete_airtime_purchase"')) {
    console.log("airtime already patched");
    return;
  }

  if (!c.includes("finalizeAirtimePurchase")) {
    const helper = `
async function finalizeAirtimePurchase(
  userId: string,
  internalReference: string,
  outcome: "successful" | "pending" | "failed",
  providerTransactionId: string,
  payload: Json,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin.rpc("trusted_complete_airtime_purchase", {
    _user_id: userId,
    _internal_reference: internalReference,
    _outcome: outcome,
    _provider_transaction_id: providerTransactionId || "",
    _payload: payload,
  });
}

`;
    const ai = c.indexOf("export const purchaseAirtime");
    if (ai < 0) throw new Error("purchaseAirtime not found");
    c = c.slice(0, ai) + helper + c.slice(ai);
  }

  c = c.replace(
    /await context\.supabase\.rpc\(\s*"complete_airtime_purchase",\s*\{([\s\S]*?)\}\s*,?\s*\)/g,
    `await finalizeAirtimePurchase(\n      context.userId,\n      row.internal_reference as string,\n      outcome,\n      pay.transactionId ?? "",\n      {\n        vtpass_code: pay.code,\n        vtpass_status: pay.contentStatus,\n        response_description: pay.responseDescription,\n        vtpass_snapshot: safePayload(pay.raw),\n      },\n    )`,
  );

  c = c.replace(
    /await supabase\.rpc\("complete_airtime_purchase",\s*\{([\s\S]*?)\}\s*,?\s*\);/g,
    `await finalizeAirtimePurchase(\n    (bill.user_id as string | null) ?? opts.userId ?? "",\n    bill.internal_reference as string,\n    outcome,\n    pay.transactionId ?? bill.provider_transaction_id ?? "",\n    {\n      vtpass_code: pay.code,\n      vtpass_status: pay.contentStatus,\n      response_description: pay.responseDescription,\n      requery: true,\n      vtpass_snapshot: safePayload(pay.raw),\n    },\n  );`,
  );

  c = c.replace(
    /const status = \(fin\?\.status \?\? outcome\) as AirtimePurchaseResult\["status"\];/g,
    'const status = (fin?.status ?? "pending") as AirtimePurchaseResult["status"];',
  );

  fs.writeFileSync(file, c);
  console.log("wrote airtime.functions.ts");
}

patchBills();
patchAirtime();
console.log("OK — git add + commit + push, Netlify on feature/rockpay-pricing.");
