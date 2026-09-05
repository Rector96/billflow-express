import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

{
  const file = path.join(root, "src/lib/vtpass.server.ts");
  let c = fs.readFileSync(file, "utf8");
  const marker = "/** Map VTpass response → RockPay outcome (never trust the browser). */";
  const i = c.indexOf(marker);
  if (i >= 0 && !c.includes("Any other provider code = failed") && !c.includes('return "failed";\n}')) {
    const body = `${marker}\nexport function mapVtpassOutcome(result: VtpassPayResult): "successful" | "failed" | "pending" {\n  const code = String(result.code ?? "").trim();\n  const s = (result.contentStatus ?? "").toLowerCase().trim();\n  const desc = (result.responseDescription ?? "").toLowerCase().trim();\n  const blob = \`\${s} \${desc}\`;\n\n  if (code === "TIMEOUT" || code === "" || code === "099") return "pending";\n  if (FAIL_CODES.has(code)) return "failed";\n\n  if (\n    s === "failed" ||\n    s === "reversed" ||\n    s === "refunded" ||\n    s === "cancelled" ||\n    s === "canceled" ||\n    blob.includes("transaction failed") ||\n    blob.includes("purchase failed") ||\n    blob.includes("insufficient") ||\n    blob.includes("invalid") ||\n    blob.includes("not successful")\n  ) {\n    return "failed";\n  }\n\n  const successHint =\n    s === "delivered" ||\n    s === "successful" ||\n    s === "success" ||\n    s === "completed" ||\n    s === "complete" ||\n    s.includes("deliver") ||\n    (blob.includes("success") && !blob.includes("unsuccess"));\n\n  if (code === "000" || code === "00" || code === "0") {\n    if (successHint) return "successful";\n    if (result.purchasedCode && String(result.purchasedCode).trim()) return "successful";\n    return "pending";\n  }\n\n  // Unknown non-success codes are failures (do not stay pending forever)\n  return "failed";\n}\n`;
    fs.writeFileSync(file, c.slice(0, i) + body);
    console.log("vtpass outcome mapper updated");
  } else if (c.includes("Any other provider code") || c.includes('code === "00"')) {
    console.log("vtpass already fixed");
  } else {
    console.log("vtpass marker missing — skip");
  }
}

{
  const file = path.join(root, "src/components/app/pay-flow.tsx");
  let c = fs.readFileSync(file, "utf8");
  let n = 0;
  if (c.includes("onSelect={(v) => setVariation(v)}")) {
    c = c.replace(
      "onSelect={(v) => setVariation(v)}",
      `onSelect={(v) => {\n                  setVariation(v);\n                  scrollIntoAction("pay-action");\n                }`,
    );
    n++;
  }
  if (c.includes('outcome === "successful" ? "Successful"')) {
    c = c.replace(
      '{outcome === "successful" ? "Successful" : outcome === "failed" ? "Failed" : "Pending"}',
      '{outcome === "successful" ? "Payment successful" : outcome === "failed" ? "Payment failed" : "Payment processing"}',
    );
    n++;
  }
  if (c.includes('navigate({ to: "/home" })') && !c.includes("View receipt")) {
    c = c.replace(
      `<Button\n            className="h-11 w-full rounded-xl font-bold"\n            onClick={() => navigate({ to: "/home" })}\n          >\n            Home\n          </Button>`,
      `<div className="space-y-2 pt-2">\n            {txId ? (\n              <Button\n                className="h-12 w-full rounded-xl font-bold"\n                onClick={() => navigate({ to: "/history/$txId", params: { txId } })}\n              >\n                View receipt\n              </Button>\n            ) : null}\n            <Button\n              variant={txId ? "outline" : "default"}\n              className="h-12 w-full rounded-xl font-bold"\n              onClick={() => navigate({ to: "/home" })}\n            >\n              Home\n            </Button>\n          </div>`,
    );
    n++;
  }
  fs.writeFileSync(file, c);
  console.log("pay-flow patches", n);
}

console.log("Done. git add src/lib/vtpass.server.ts src/components/app/pay-flow.tsx && commit && push");
