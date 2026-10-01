/**
 * Server-side hub preview gate.
 *
 * Default: enabled (so CAC/NIN UI can be exercised without every key).
 * Production: set HUB_PREVIEW_FLOWS=false (and do not set HUB_ALLOW_UNVERIFIED_PAY)
 * so demo payment references are rejected when PAYSTACK_SECRET_KEY is present.
 */
function readEnvFlag(key: string, defaultValue: boolean): boolean {
  try {
    const raw = String(process.env[key] ?? "").trim().toLowerCase();
    if (!raw) return defaultValue;
    if (["0", "false", "no", "off"].includes(raw)) return false;
    if (["1", "true", "yes", "on"].includes(raw)) return true;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

/** True when hub demo/preview submits are allowed without live bill flags. */
export function isHubPreviewServerEnabled(): boolean {
  return readEnvFlag("HUB_PREVIEW_FLOWS", true);
}

/** True when PSK_DEMO_ refs may pass without Paystack verify. */
export function isHubUnverifiedPayAllowed(): boolean {
  return readEnvFlag("HUB_ALLOW_UNVERIFIED_PAY", false) || isHubPreviewServerEnabled();
}
