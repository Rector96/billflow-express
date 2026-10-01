import fs from "fs";
const p = "src/lib/vtpass.server.ts";
let c = fs.readFileSync(p, "utf8");
const marker = "export function mapVtpassOutcome";
const i = c.indexOf(marker);
if (i < 0) throw new Error("mapVtpassOutcome not found");
const neu = `export function mapVtpassOutcome(result: VtpassPayResult): "successful" | "failed" | "pending" {
  const code = String(result.code ?? "").trim();
  const s = (result.contentStatus ?? "").toLowerCase().trim();
  const desc = (result.responseDescription ?? "").toLowerCase().trim();
  const blob = \`\${s} \${desc}\`;

  if (code === "TIMEOUT" || code === "099") return "pending";
  if (FAIL_CODES.has(code)) return "failed";

  if (
    s === "failed" ||
    s === "reversed" ||
    s === "refunded" ||
    s === "cancelled" ||
    s === "canceled" ||
    blob.includes("transaction failed") ||
    blob.includes("purchase failed") ||
    blob.includes("not successful")
  ) {
    return "failed";
  }

  if (s === "pending" || s === "initiated" || s === "processing" || s === "in-progress") {
    return "pending";
  }

  if (code === "000" || code === "00" || code === "0") return "successful";

  if (
    s === "delivered" ||
    s === "successful" ||
    s === "success" ||
    s === "completed" ||
    s === "complete" ||
    s.includes("deliver") ||
    (blob.includes("success") && !blob.includes("unsuccess"))
  ) {
    return "successful";
  }

  if (result.purchasedCode && String(result.purchasedCode).trim()) return "successful";
  if (code === "" && !s && !desc) return "pending";
  return "failed";
}
`;
// function is last export in this file
c = c.slice(0, i) + neu;
fs.writeFileSync(p, c);
console.log("patched mapVtpassOutcome OK");
