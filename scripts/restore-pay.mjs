#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const partsDir = join(__dirname, "pay-parts");
const target = join(__dirname, "..", "src", "routes", "pay.$slug.tsx");
const b64 = [0, 1, 2, 3]
  .map((i) => readFileSync(join(partsDir, `b64-${i}.txt`), "utf8").trim())
  .join("");
const buf = inflateSync(Buffer.from(b64, "base64"));
writeFileSync(target, buf);
console.log("[restore-pay] wrote", target, "bytes", buf.length);
