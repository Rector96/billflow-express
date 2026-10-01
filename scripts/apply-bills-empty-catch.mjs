/**
 * Fix eslint no-empty on phone normalize catches only.
 * node scripts/apply-bills-empty-catch.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src/lib/bills.functions.ts",
);
let c = fs.readFileSync(file, "utf8");
const old = `    if (data.phone) {
      try {
        phone = normalizeNgPhone(data.phone);
      } catch {}
    }`;
const neu = `    if (data.phone) {
      try {
        phone = normalizeNgPhone(data.phone);
      } catch {
        // Keep the provider fallback phone when normalization fails.
      }
    }`;
if (!c.includes(old)) {
  if (c.includes("Keep the provider fallback phone")) {
    console.log("already fixed");
    process.exit(0);
  }
  throw new Error("empty catch pattern not found");
}
const n = c.split(old).length - 1;
c = c.split(old).join(neu);
fs.writeFileSync(file, c);
console.log("fixed", n, "empty catch(es)");
