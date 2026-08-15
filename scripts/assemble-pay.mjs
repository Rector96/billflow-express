import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
const b64 = [0, 1, 2]
  .map((i) => readFileSync(join(dir, `pay-payload.${i}.b64`), "utf8"))
  .join("");
const out = Buffer.from(b64, "base64");
writeFileSync(join(dir, "../src/routes/pay.$slug.tsx"), out);
console.log("[assemble-pay] wrote pay.$slug.tsx", out.length, "bytes");
