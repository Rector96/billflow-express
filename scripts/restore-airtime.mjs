#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const parts = [0, 1, 2].map((i) =>
  readFileSync(join(root, "scripts/pay-parts", `af${i}.txt`), "utf8"),
);
const target = join(root, "src/lib/airtime.functions.ts");
writeFileSync(target, parts.join(""));
console.log("[restore-airtime] wrote", target, "bytes", parts.join("").length);
