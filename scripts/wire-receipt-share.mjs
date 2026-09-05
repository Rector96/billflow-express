#!/usr/bin/env node
import fs from "fs";
const path = "src/routes/history.$txId.tsx";
let c = fs.readFileSync(path, "utf8");
if (c.includes("ReceiptShareButton")) {
  console.log("Share receipt already wired");
  process.exit(0);
}
if (!c.includes('from "@/components/app/receipt-share-sheet"')) {
  c = c.replace(
    'import { AppShell }',
    'import { ReceiptShareButton } from "@/components/app/receipt-share-sheet";\nimport { AppShell }',
  );
}
const marker = "<CareContextLink";
if (!c.includes(marker)) {
  console.error("CareContextLink not found");
  process.exit(1);
}
const block = `          <ReceiptShareButton
            payload={{
              reference: txId,
              title: (bill?.service as string) || tx?.title || "Payment",
              status: String(status),
              amountLabel: new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency: "NGN",
                maximumFractionDigits: 0,
              }).format(Math.abs(Number(amount) || 0)),
              direction: (tx?.direction as "in" | "out") || "out",
              service: (bill?.service as string) || tx?.service || null,
              network: network || null,
              recipient: phone || null,
              providerRef: providerRef || null,
              channel: channel || null,
              dateLabel: bill?.created_at
                ? new Date(bill.created_at).toLocaleString("en-NG")
                : \`${tx?.date ?? ""} ${tx?.time ?? ""}\`.trim() || null,
              method: tx?.method || null,
              tokenLabel: tx?.token ? "Token / PIN" : null,
              tokenValue: tx?.token || null,
            }}
          />
          `;
c = c.replace(marker, block + marker);
fs.writeFileSync(path, c);
console.log("Share receipt wired on history detail");
