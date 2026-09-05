#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// 1) Airtime: debit face value only
const airPath = join(root, "src/lib/airtime.functions.ts");
let air = readFileSync(airPath, "utf8");
const oldBlock = `    const providerAmount = data.amount;
    const pricing = await resolvePricing({
      service: "airtime",
      provider: serviceId,
      productCode: null,
      baseAmount: providerAmount,
    });
    const customerAmount = pricing.customerAmount;`;
const newBlock = `    // OPay-style: customer types face value and pays exactly that.
    // RockPay profit comes from VTpass commission/discount, not a customer surcharge.
    const providerAmount = data.amount;
    const pricing = await resolvePricing({
      service: "airtime",
      provider: serviceId,
      productCode: null,
      baseAmount: providerAmount,
    });
    // Always debit face value for airtime (ignore customer-facing markup rules).
    const customerAmount = providerAmount;
    void pricing;`;
if (air.includes("customerAmount = providerAmount")) {
  console.log("[patch] airtime already face-value");
} else if (!air.includes(oldBlock)) {
  console.error("[patch] airtime block not found — abort");
  process.exit(1);
} else {
  air = air.replace(oldBlock, newBlock);
  air = air.replace(/rockpay_fee: pricing\.rockpayFee/g, "rockpay_fee: 0");
  air = air.replace(/rockpayFee: pricing\.rockpayFee/g, "rockpayFee: 0");
  writeFileSync(airPath, air);
  console.log("[patch] airtime face-value applied", airPath);
}

// 2) Pay UI label
const payPath = join(root, "src/routes/pay.$slug.tsx");
let pay = readFileSync(payPath, "utf8");
if (pay.includes("Airtime amount")) {
  console.log("[patch] pay UI already updated");
} else {
  const i = pay.indexOf('htmlFor="amount"');
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
  console.log("[patch] pay amount UI updated");
}

console.log("[patch] done — commit the changed files");
