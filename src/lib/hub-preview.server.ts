/**
 * Server-side mirror of hub UI preview flag.
 * Default ON so CAC/NIN demo submits work on Netlify while the product is unfinished.
 * Set HUB_PREVIEW_FLOWS=false or VITE_HUB_PREVIEW_FLOWS=false to hard-close demo APIs.
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

  return true;
}
