/**
 * Server-side hub preview — always allow demo submits on this branch.
 * Matches FORCE_HUB_UI in product-mode.ts so CAC/NIN are not “not available”.
 */
export function isHubPreviewServerEnabled(): boolean {
  return true;
}
