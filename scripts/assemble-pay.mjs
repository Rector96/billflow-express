import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const partsDir = join(root, "scripts", "pay-parts");
const out = join(root, "src", "routes", "pay.$slug.tsx");
const parts = [0, 1, 2, 3].map((i) => readFileSync(join(partsDir, `part${i}.txt`), "utf8"));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, parts.join(""));
console.log("[assemble-pay] wrote", out, "bytes", parts.join("").length);
