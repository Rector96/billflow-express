// Restores src/routes/pay.$slug.tsx (compressed payload).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const target = join(root, "src/routes/pay.$slug.tsx");

// Payload written by build agent — run: node scripts/restore-pay.mjs
// If this file is incomplete, checkout pay from git history df9c3c82
console.error("[restore-pay] Incomplete script on remote — expand from agent artifact.");
process.exit(1);
