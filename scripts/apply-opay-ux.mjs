#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function writeFromB64(rel, parts) {
  const b64 = parts
    .map((p) => readFileSync(join(root, "scripts", "pay-parts", p), "utf8").trim())
    .join("");
  const buf = Buffer.from(b64, "base64");
  writeFileSync(join(root, rel), buf);
  console.log("[apply-opay-ux] wrote", rel, "bytes", buf.length);
}

writeFromB64("src/components/app/exam-pins-flow.tsx", [
  "exam_p0.txt",
  "exam_p1.txt",
  "exam_p2.txt",
  "exam_p3.txt",
]);
writeFromB64("src/lib/airtime.functions.ts", [
  "air_p0.txt",
  "air_p1.txt",
  "air_p2.txt",
  "air_p3.txt",
  "air_p4.txt",
  "air_p5.txt",
]);

const payPath = join(root, "src/routes/pay.$slug.tsx");
let pay = readFileSync(payPath, "utf8");
if (!pay.includes("Airtime amount")) {
  const marker = 'htmlFor="amount"';
  const i = pay.indexOf(marker);
  if (i >= 0) {
    const j = pay.indexOf("Amount to pay", i);
    if (j >= 0) {
      pay =
        pay.slice(0, j) +
        '{isAirtime ? "Airtime amount" : "Amount to pay"}' +
        pay.slice(j + "Amount to pay".length);
    }
  }
  if (!pay.includes("No extra fee")) {
    const needle =
      'className="h-12 border-0 bg-transparent text-center text-3xl font-extrabold shadow-none focus-visible:ring-0"\n                  />\n                </div>\n              </div>';
    const insert =
      'className="h-12 border-0 bg-transparent text-center text-3xl font-extrabold shadow-none focus-visible:ring-0"\n                  />\n                </div>\n                {isAirtime ? (\n                  <p className="mt-2 text-[11px] text-muted-foreground">\n                    Phone receives exactly this amount. No extra fee.\n                  </p>\n                ) : null}\n              </div>';
    if (pay.includes(needle)) pay = pay.replace(needle, insert);
  }
  writeFileSync(payPath, pay);
  console.log("[apply-opay-ux] patched pay.$slug.tsx amount UI");
} else {
  console.log("[apply-opay-ux] pay UI already patched");
}
