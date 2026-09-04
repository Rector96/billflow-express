#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const a = readFileSync(join(root, "scripts/pay-parts/air_src_0.txt"), "utf8");
const b = readFileSync(join(root, "scripts/pay-parts/air_src_1.txt"), "utf8");
const target = join(root, "src/lib/airtime.functions.ts");
writeFileSync(target, a + b);
console.log("[restore-airtime] wrote", target, "bytes", (a + b).length);
