#!/usr/bin/env node
const fs = require("fs");
const path = "src/components/app/app-shell.tsx";
let c = fs.readFileSync(path, "utf8");
if (c.includes("hasTransactionPin")) {
  console.log("PIN gate already present");
  process.exit(0);
}
if (!c.includes('from "@/lib/pin.functions"')) {
  c = c.replace(
    'import { useEffect, useState, type ReactNode } from "react";\nimport { useApp } from "@/lib/app-store";',
    'import { useEffect, useState, type ReactNode } from "react";\nimport { useServerFn } from "@tanstack/react-start";\nimport { useApp } from "@/lib/app-store";\nimport { hasTransactionPin } from "@/lib/pin.functions";',
  );
}
const needle = `  useEffect(() => {
    if (hydrated && !authed) void navigate({ to: "/login", replace: true });
  }, [hydrated, authed, navigate]);
`;
if (!c.includes(needle)) {
  console.error("auth effect not found");
  process.exit(1);
}
if (!c.includes("const checkPin = useServerFn")) {
  c = c.replace(
    "  const navigate = useNavigate();\n  const [offline, setOffline] = useState(false);",
    "  const navigate = useNavigate();\n  const checkPin = useServerFn(hasTransactionPin);\n  const [offline, setOffline] = useState(false);",
  );
}
const gate = `  useEffect(() => {
    if (hydrated && !authed) void navigate({ to: "/login", replace: true });
  }, [hydrated, authed, navigate]);

  // Force 4-digit transaction PIN before using the app (except setup-pin itself)
  useEffect(() => {
    if (!hydrated || !authed) return;
    if (pathname === "/setup-pin" || pathname.startsWith("/setup-pin")) return;
    let cancelled = false;
    void checkPin({})
      .then((res) => {
        if (cancelled) return;
        if (!res?.hasPin) {
          void navigate({ to: "/setup-pin", replace: true });
        }
      })
      .catch(() => {
        /* RPC missing in some envs — don't soft-lock the whole app */
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, authed, pathname, checkPin, navigate]);
`;
c = c.replace(needle, gate);
fs.writeFileSync(path, c);
console.log("PIN gate wired in AppShell");
