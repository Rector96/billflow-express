/**
 * Server-side mirror of hub UI preview flag.
 * When true (default), regulated hub endpoints may return clearly synthetic
 * demo data so product QA can walk flows without Dojah/live providers.
 *
 * Production: set VITE_HUB_PREVIEW_FLOWS=false (and optionally HUB_PREVIEW_FLOWS=false)
 * on Netlify so these paths refuse again until isBillLive() is true.
 */
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
  // Default ON while the product is unfinished (matches product-mode.ts).
  return true;
}
