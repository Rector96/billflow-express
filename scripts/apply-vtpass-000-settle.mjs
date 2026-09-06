/**
 * Apply VTpass 000 → successful mapping + hardened wallet sync.
 * node scripts/apply-vtpass-000-settle.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const MAP_FN = `/** Map VTpass response \u2192 RockPay outcome (never trust the browser).
 * VTpass convention: code 000 = processed; 099 = still processing; other known codes = fail.
 * Do NOT leave code 000 as pending forever \u2014 that is why history stuck on Pending.
 */
export function mapVtpassOutcome(result: VtpassPayResult): "successful" | "failed" | "pending" {
  const code = String(result.code ?? "").trim();
  const s = (result.contentStatus ?? "").toLowerCase().trim();
  const desc = (result.responseDescription ?? "").toLowerCase().trim();
  const blob = \`${s} ${desc}\`;

  // True in-flight only
  if (code === "TIMEOUT" || code === "099") return "pending";
  if (code === "" && !s && !desc) return "pending";

  if (FAIL_CODES.has(code)) return "failed";

  // Explicit failure in body (even if code is 000 in rare cases)
  if (
    s === "failed" ||
    s === "reversed" ||
    s === "refunded" ||
    s === "cancelled" ||
    s === "canceled" ||
    blob.includes("transaction failed") ||
    blob.includes("purchase failed") ||
    blob.includes("insufficient wallet") ||
    blob.includes("insufficient fund") ||
    blob.includes("not successful")
  ) {
    return "failed";
  }

  // Still processing at provider
  if (s === "pending" || s === "initiated" || s === "processing" || s === "in-progress") {
    return "pending";
  }

  // VTpass: 000 / 00 / 0 = TRANSACTION PROCESSED \u2192 treat as successful
  if (code === "000" || code === "00" || code === "0") {
    return "successful";
  }

  // Explicit success wording without standard code
  if (
    s === "delivered" ||
    s === "successful" ||
    s === "success" ||
    s === "completed" ||
    (blob.includes("success") && !blob.includes("unsuccess"))
  ) {
    return "successful";
  }

  if (result.purchasedCode && String(result.purchasedCode).trim()) return "successful";

  // Unknown non-success codes are failures (do not stay pending forever)
  return "failed";
}`;

const SYNC_FN = `async function syncWalletLedgerStatus(
  internalReference: string,
  status: "successful" | "pending" | "failed",
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  let res = await supabaseAdmin
    .from("wallet_transactions")
    .update({ status, updated_at: now }, { count: "exact" })
    .eq("metadata->>bill_reference", internalReference);
  if (res.error || res.count === 0) {
    res = await supabaseAdmin
      .from("wallet_transactions")
      .update({ status, updated_at: now }, { count: "exact" })
      .filter("metadata->>bill_reference", "eq", internalReference);
  }
  if (res.error) {
    console.error("[settle] wallet_transactions sync", internalReference, res.error.message);
  } else if (!res.count) {
    console.warn("[settle] wallet sync matched 0 rows", internalReference, status);
  }
}\n\n`;

function patchVtpass() {
  const file = path.join(root, "src/lib/vtpass.server.ts");
  let c = fs.readFileSync(file, "utf8");
  if (c.includes("Do NOT leave code 000 as pending")) {
    console.log("vtpass map already fixed");
    return;
  }
  const start = c.indexOf("/** Map VTpass response");
  const exportStart = c.indexOf("export function mapVtpassOutcome");
  const from = start >= 0 ? start : exportStart;
  if (from < 0) throw new Error("mapVtpassOutcome missing");
  const rest = c.slice(exportStart);
  let brace = 0, started = false, end = 0;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "{") { brace++; started = true; }
    else if (rest[i] === "}") {
      brace--;
      if (started && brace === 0) { end = i + 1; break; }
    }
  }
  c = c.slice(0, from) + MAP_FN + c.slice(exportStart + end);
  fs.writeFileSync(file, c);
  console.log("patched mapVtpassOutcome");
}

function patchBillsSync() {
  const file = path.join(root, "src/lib/bills.functions.ts");
  let c = fs.readFileSync(file, "utf8");
  if (c.includes("wallet sync matched 0 rows")) {
    console.log("bills sync already hardened");
    return;
  }
  const start = c.indexOf("async function syncWalletLedgerStatus");
  if (start < 0) {
    console.log("syncWalletLedgerStatus missing \u2014 skip");
    return;
  }
  const end = c.indexOf("async function finalizeBillPurchase", start);
  if (end < 0) throw new Error("finalizeBillPurchase missing");
  c = c.slice(0, start) + SYNC_FN + c.slice(end);
  fs.writeFileSync(file, c);
  console.log("patched syncWalletLedgerStatus");
}

patchVtpass();
patchBillsSync();
console.log("OK \u2014 git add src/lib/vtpass.server.ts src/lib/bills.functions.ts && commit && push");
