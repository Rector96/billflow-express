import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
const out = [0, 1, 2, 3, 4]
  .map((i) => readFileSync(join(dir, `pay-part-${i}.tsx.txt`), "utf8"))
  .join("");
writeFileSync(join(dir, "../src/routes/pay.$slug.tsx"), out);
console.log("[assemble-pay] wrote pay.$slug.tsx", out.length, "bytes");
