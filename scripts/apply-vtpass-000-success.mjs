/**
 * Treat VTpass response code 000 as successful (unless still processing/failed).
 * node scripts/apply-vtpass-000-success.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src/lib/vtpass.server.ts",
);
let c = fs.readFileSync(file, "utf8");
const start = c.indexOf("export function mapVtpassOutcome");
if (start < 0) throw new Error("mapVtpassOutcome not found");
const after = c.slice(start);
const closeIdx = after.search(/\nexport (async )?function |\nexport const /);
if (closeIdx < 0) throw new Error("no next export");
const oldFn = after.slice(0, closeIdx);
if (
  oldFn.includes('if (code === "000"') &&
  oldFn.includes('return "successful";') &&
  oldFn.includes('s === "pending"') &&
  !oldFn.includes("successHint")
) {
  console.log("already production 000 mapping");
  process.exit(0);
}
const neu = `/** VTpass: code 000 = processed; 099/TIMEOUT = still processing. Prefer successful on 000. */
export function mapVtpassOutcome(result: VtpassPayResult): "successful" | "failed" | "pending" {
  const code = String(result.code ?? "").trim();
  const s = (result.contentStatus ?? "").toLowerCase().trim();
  const desc = (result.responseDescription ?? "").toLowerCase().trim();
  const blob = \`\${s} \${desc}\`;

  if (code === "TIMEOUT" || code === "099") return "pending";
  if (code === "" && !s && !desc) return "pending";
  if (FAIL_CODES.has(code)) return "failed";

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

  if (s === "pending" || s === "initiated" || s === "processing" || s === "in-progress") {
    return "pending";
  }

  if (code === "000" || code === "00" || code === "0") {
    return "successful";
  }

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
  return "failed";
}
`;
const absEnd = start + closeIdx;
c = c.slice(0, start) + neu + c.slice(absEnd);
fs.writeFileSync(file, c);
console.log("patched mapVtpassOutcome");
