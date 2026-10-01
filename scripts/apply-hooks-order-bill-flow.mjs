/**
 * Fix React Hooks order in rockpay-bill-flow.tsx
 * Move service early-returns below all hooks.
 * node scripts/apply-hooks-order-bill-flow.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "src/components/app/rockpay-bill-flow.tsx");
let c = fs.readFileSync(file, "utf8");

if (
  c.includes("const buyAirtime = useServerFn") &&
  c.indexOf("const buyAirtime") < c.indexOf('if (slug === "education")')
) {
  console.log("hooks order already fixed");
  process.exit(0);
}

const re =
  /\n  if \(slug === "education"\) return <ExamPinsFlow entryTitle="Education" \/>;\n  if \(slug === "exam-pins"\) return <ExamPinsFlow entryTitle="Exam Pins" \/>;\n\n  if \(slug === "internet" \|\| slug === "water" \|\| slug === "insurance"\) \{[\s\S]*?\n  \}\n\n  if \(!service\) \{[\s\S]*?\n  \}\n/;
const m = c.match(re);
if (!m) throw new Error("could not match early-return block");
const block = m[0];
c = c.replace(re, "\n");

c = c.replace(
  /const isAirtime = service\.slug === "airtime";\n  const isCable = service\.slug === "cable";\n  const isElectricity = service\.slug === "electricity";\n  const isData = service\.slug === "data";/,
  `const isAirtime = service?.slug === "airtime";\n  const isCable = service?.slug === "cable";\n  const isElectricity = service?.slug === "electricity";\n  const isData = service?.slug === "data";`,
);

const marker = "  const startVerify = async () => {";
if (!c.includes(marker)) throw new Error("startVerify missing");
c = c.replace(marker, block.trimEnd() + "\n\n" + marker);

fs.writeFileSync(file, c);
console.log("patched rockpay-bill-flow.tsx hooks order");
