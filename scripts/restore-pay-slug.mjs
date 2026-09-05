#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const n = 7;
const b64 = Array.from({ length: n }, (_, i) =>
  readFileSync(join(root, "scripts/pay-restore-parts", `p${i}.txt`), "utf8").trim(),
).join("");
const buf = Buffer.from(b64, "base64");
writeFileSync(join(root, "src/routes/pay.$slug.tsx"), buf);
console.log("[restore-pay-slug] wrote", buf.length, "bytes");
