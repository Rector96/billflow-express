/**
 * Deep fix: success page vs history pending.
 * node scripts/apply-pending-success-fix.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const BILLS_HELPER = `/** Settlement must use service_role — authenticated lost EXECUTE on complete_bill_purchase. */
async function syncWalletLedgerStatus(
  internalReference: string,
  status: "successful" | "pending" | "failed",
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("wallet_transactions")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .filter("metadata->>bill_reference", "eq", internalReference);
  if (error) {
    console.error("[settle] wallet_transactions sync", internalReference, error.message);
  }
}

async function finalizeBillPurchase(
  userId: string,
  internalReference: string,
  outcome: "successful" | "pending" | "failed",
  providerTransactionId: string,
  payload: Json,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("trusted_complete_bill_purchase", {
    _user_id: userId,
    _internal_reference: internalReference,
    _outcome: outcome,
    _provider_transaction_id: providerTransactionId || "",
    _payload: payload,
  });

  if (error) {
    console.error("[settle] trusted_complete_bill_purchase", internalReference, error.message, outcome);
    if (outcome === "successful" || outcome === "failed") {
      const { error: bErr } = await supabaseAdmin
        .from("bill_transactions")
        .update({
          status: outcome,
          provider_transaction_id: providerTransactionId || null,
          provider_response_code: String((payload as { vtpass_code?: string })?.vtpass_code ?? "") || null,
          provider_status: String((payload as { vtpass_status?: string })?.vtpass_status ?? "") || null,
          provider_response_message:
            String((payload as { response_description?: string })?.response_description ?? "") || null,
          updated_at: new Date().toISOString(),
          metadata: payload,
        })
        .eq("internal_reference", internalReference)
        .eq("status", "pending");
      if (bErr) console.error("[settle] bill fallback", bErr.message);
      await syncWalletLedgerStatus(internalReference, outcome);
      return {
        data: [
          {
            bill_id: null,
            internal_reference: internalReference,
            status: outcome,
            balance_after: null,
            refunded: outcome === "failed",
          },
        ],
        error: null,
      };
    }
    return { data, error };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const finalStatus = (row?.status ?? outcome) as "successful" | "pending" | "failed";
  await syncWalletLedgerStatus(internalReference, finalStatus);
  return { data, error: null };
}

`;

const AIRTIME_HELPER = `async function finalizeAirtimePurchase(
  userId: string,
  internalReference: string,
  outcome: "successful" | "pending" | "failed",
  providerTransactionId: string,
  payload: Json,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("trusted_complete_airtime_purchase", {
    _user_id: userId,
    _internal_reference: internalReference,
    _outcome: outcome,
    _provider_transaction_id: providerTransactionId || "",
    _payload: payload,
  });

  if (error) {
    console.error("[airtime settle]", internalReference, error.message, outcome);
    if (outcome === "successful" || outcome === "failed") {
      await supabaseAdmin
        .from("bill_transactions")
        .update({
          status: outcome,
          provider_transaction_id: providerTransactionId || null,
          updated_at: new Date().toISOString(),
          metadata: payload,
        })
        .eq("internal_reference", internalReference)
        .eq("status", "pending");
      await supabaseAdmin
        .from("wallet_transactions")
        .update({ status: outcome, updated_at: new Date().toISOString() })
        .filter("metadata->>bill_reference", "eq", internalReference);
      return {
        data: [{ status: outcome, internal_reference: internalReference, balance_after: null }],
        error: null,
      };
    }
    return { data, error };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const finalStatus = (row?.status ?? outcome) as "successful" | "pending" | "failed";
  await supabaseAdmin
    .from("wallet_transactions")
    .update({ status: finalStatus, updated_at: new Date().toISOString() })
    .filter("metadata->>bill_reference", "eq", internalReference);
  return { data, error: null };
}

`;

function patchBills() {
  const file = path.join(root, "src/lib/bills.functions.ts");
  let c = fs.readFileSync(file, "utf8");
  if (c.includes("syncWalletLedgerStatus")) {
    console.log("bills already has syncWalletLedgerStatus");
    return;
  }
  const start = c.indexOf("/** Settlement must use service_role");
  const end = c.indexOf("export const listVtpassServices");
  if (start >= 0 && end > start) {
    c = c.slice(0, start) + BILLS_HELPER + c.slice(end);
  } else {
    const ai = c.indexOf("export const listVtpassServices");
    if (ai < 0) throw new Error("listVtpassServices missing");
    c = c.slice(0, ai) + BILLS_HELPER + c.slice(ai);
  }
  fs.writeFileSync(file, c);
  console.log("patched bills.functions.ts");
}

function patchAirtime() {
  const file = path.join(root, "src/lib/airtime.functions.ts");
  let c = fs.readFileSync(file, "utf8");
  if (c.includes("[airtime settle]")) {
    console.log("airtime already patched");
    return;
  }
  const start = c.indexOf("async function finalizeAirtimePurchase");
  const end = c.indexOf("export const purchaseAirtime");
  if (start >= 0 && end > start) {
    c = c.slice(0, start) + AIRTIME_HELPER + c.slice(end);
  } else {
    const ai = c.indexOf("export const purchaseAirtime");
    c = c.slice(0, ai) + AIRTIME_HELPER + c.slice(ai);
  }
  fs.writeFileSync(file, c);
  console.log("patched airtime.functions.ts");
}

function patchStore() {
  const file = path.join(root, "src/lib/app-store.tsx");
  let c = fs.readFileSync(file, "utf8");
  if (c.includes("Prefer bill_transactions.status")) {
    console.log("app-store already patched");
    return;
  }
  const old = `if (w.data) setBalance(money(w.data.balance));\n      if (ledger.data) setTransactions(ledger.data.map((r) => toTransaction(r as LedgerRow)));`;
  const STORE_LEDGER = `if (ledger.data) {\n        const rows = ledger.data as LedgerRow[];\n        // Prefer bill_transactions.status when a wallet row is a bill payment\n        // (fixes success page vs history pending drift).\n        const billRefs = rows\n          .map((r) => {\n            const m = r.metadata ?? {};\n            return typeof m["bill_reference"] === "string" ? (m["bill_reference"] as string) : null;\n          })\n          .filter((x): x is string => Boolean(x));\n        let billStatus = new Map<string, string>();\n        if (billRefs.length) {\n          const { data: bills } = await supabase\n            .from("bill_transactions")\n            .select("internal_reference, status")\n            .in("internal_reference", billRefs);\n          for (const b of bills ?? []) {\n            billStatus.set(String(b.internal_reference), String(b.status));\n          }\n        }\n        setTransactions(\n          rows.map((r) => {\n            const ref =\n              r.metadata && typeof r.metadata["bill_reference"] === "string"\n                ? (r.metadata["bill_reference"] as string)\n                : null;\n            const override = ref ? billStatus.get(ref) : undefined;\n            if (override && override !== r.status) {\n              return toTransaction({ ...r, status: override });\n            }\n            return toTransaction(r);\n          }),\n        );\n      }`;
  if (c.includes(old)) {
    c = c.replace(old, `if (w.data) setBalance(money(w.data.balance));\n      ${STORE_LEDGER}`);
  } else if (c.includes("ledger.data.map((r) => toTransaction")) {
    c = c.replace(
      /if \(ledger\.data\) setTransactions\(ledger\.data\.map\(\(r\) => toTransaction\(r as LedgerRow\)\)\);/,
      STORE_LEDGER,
    );
  } else {
    throw new Error("ledger map not found");
  }
  fs.writeFileSync(file, c);
  console.log("patched app-store.tsx");
}

patchBills();
patchAirtime();
patchStore();
console.log(
  "OK — commit src/lib/bills.functions.ts src/lib/airtime.functions.ts src/lib/app-store.tsx",
);
console.log("Run docs/SQL_FIX_SETTLEMENT_JWT.sql in Supabase SQL Editor.");
