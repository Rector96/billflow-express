#!/usr/bin/env node
const fs = require("fs");
const path = "src/routes/home.tsx";
let c = fs.readFileSync(path, "utf8");
if (c.includes("HomePromos")) {
  console.log("HomePromos already present");
  process.exit(0);
}
if (!c.includes('from "@/components/app/home-promos"')) {
  c = c.replace(
    'import { WalletCard } from "@/components/app/wallet-card";',
    'import { WalletCard } from "@/components/app/wallet-card";\nimport { HomePromos } from "@/components/app/home-promos";',
  );
}
const idx = c.indexOf("<WalletCard");
if (idx < 0) {
  console.error("WalletCard not found");
  process.exit(1);
}
const end = c.indexOf("/>", idx);
const insertAt = c.indexOf("\n", end) + 1;
c = c.slice(0, insertAt) + '\n          <HomePromos className="mt-3" />\n' + c.slice(insertAt);
fs.writeFileSync(path, c);
console.log("HomePromos wired");
