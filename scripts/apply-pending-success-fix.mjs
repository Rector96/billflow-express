/**
 * Apply pending-vs-success fix to settlement + history.
 * Run: node scripts/apply-pending-success-fix.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function applyB64(rel, destRel) {
  const b64path = path.join(root, "scripts", rel);
  if (!fs.existsSync(b64path)) {
    console.log("skip missing", rel);
    return;
  }
  const dest = path.join(root, destRel);
  fs.writeFileSync(dest, Buffer.from(fs.readFileSync(b64path, "utf8"), "base64"));
  console.log("wrote", destRel);
}

applyB64("payload-bills.functions.ts.b64", "src/lib/bills.functions.ts");
applyB64("payload-airtime.functions.ts.b64", "src/lib/airtime.functions.ts");
applyB64("payload-app-store.tsx.b64", "src/lib/app-store.tsx");
console.log("Done. Commit the three src/lib files and push. Run docs/SQL_FIX_SETTLEMENT_JWT.sql in Supabase.");
