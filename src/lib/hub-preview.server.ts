/**
 * Server-side mirror of hub UI preview flag.
 *
 * Production (Netlify CONTEXT=production or NODE_ENV=production):
 *   Default OFF — demo fulfillment refuses unless explicitly enabled.
 * Dev / branch deploys:
 *   Default ON so QA can walk flows without Dojah.
 *
 * Explicit env always wins:
 *   HUB_PREVIEW_FLOWS or VITE_HUB_PREVIEW_FLOWS = true|false
 */
function isProductionRuntime(): boolean {
  const ctx = String(process.env["CONTEXT"] ?? "").toLowerCase();
  if (ctx === "production") return true;
  if (String(process.env["NODE_ENV"] ?? "").toLowerCase() === "production") return true;
  return false;
}

export function isHubPreviewServerEnabled(): boolean {
  const candidates = [process.env["HUB_PREVIEW_FLOWS"], process.env["VITE_HUB_PREVIEW_FLOWS"]];
  try {
    const vite = (import.meta as { env?: Record<string, string | boolean | undefined> }).env;
    if (vite && "VITE_HUB_PREVIEW_FLOWS" in vite) {
      candidates.unshift(vite["VITE_HUB_PREVIEW_FLOWS"] as string | boolean | undefined);
    }
  } catch {
    /* non-vite runtime */
  }

  for (const raw of candidates) {
    if (raw === undefined || raw === "") continue;
    if (typeof raw === "boolean") return raw;
    const s = String(raw).trim().toLowerCase();
    if (["0", "false", "no", "off"].includes(s)) return false;
    if (["1", "true", "yes", "on"].includes(s)) return true;
  }

  // Safe default: no synthetic hub fulfillment on production hosts.
  return !isProductionRuntime();
}
