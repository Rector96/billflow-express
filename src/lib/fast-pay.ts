import type { Package, SavedPayment, Transaction } from "@/lib/mock-data";
import { getService } from "@/lib/mock-data";

export type RecentBeneficiary = {
  key: string;
  provider: string;
  identifier: string;
  label: string;
  masked: string;
  savedId?: string;
  lastAmount?: number;
};

/** Mask identifier for display — never invent full numbers. */
export function maskId(id: string): string {
  const s = id.trim();
  if (s.length <= 4) return "••••";
  if (s.length <= 8) return `${s.slice(0, 2)}•••${s.slice(-2)}`;
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}

/**
 * Beneficiaries the user explicitly saved for this service.
 * Full identifiers only come from authorized saved_payments rows.
 */
export function recentSavedForService(
  slug: string,
  saved: SavedPayment[],
  limit = 3,
): RecentBeneficiary[] {
  return saved
    .filter((s) => s.serviceSlug === slug)
    .slice(0, limit)
    .map((s) => ({
      key: s.id,
      provider: s.provider,
      identifier: s.identifier,
      label: s.label,
      masked: s.masked || maskId(s.identifier),
      savedId: s.id,
    }));
}

/**
 * Successful outbound amounts for this service (hints only).
 * Does not reconstruct identifiers from masked history.
 */
export function recentAmountsForService(
  slug: string,
  transactions: Transaction[],
  defaults: number[] | undefined,
  limit = 4,
): number[] {
  const fromHistory = transactions
    .filter(
      (t) =>
        t.status === "successful" &&
        t.direction === "out" &&
        t.serviceSlug === slug &&
        t.amount > 0,
    )
    .map((t) => Math.round(t.amount));

  const merged: number[] = [];
  const seen = new Set<number>();
  for (const a of [...fromHistory, ...(defaults ?? [])]) {
    if (a < 100 || seen.has(a)) continue;
    seen.add(a);
    merged.push(a);
    if (merged.length >= limit) break;
  }
  return merged;
}

/** Match recent successful titles/services to catalog packages (by name). */
export function recentPackagesForService(
  slug: string,
  transactions: Transaction[],
  packages: Package[] | undefined,
  limit = 3,
): Package[] {
  if (!packages?.length) return [];
  const hits: Package[] = [];
  const seen = new Set<string>();
  for (const t of transactions) {
    if (t.status !== "successful" || t.direction !== "out" || t.serviceSlug !== slug) continue;
    const hay = `${t.title} ${t.service}`.toLowerCase();
    const pack = packages.find(
      (p) => hay.includes(p.name.toLowerCase()) || Math.round(t.amount) === Math.round(p.price),
    );
    if (pack && !seen.has(pack.id)) {
      seen.add(pack.id);
      hits.push(pack);
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

export function lastSuccessfulProvider(slug: string, transactions: Transaction[]): string | null {
  const svc = getService(slug);
  if (!svc) return null;
  for (const t of transactions) {
    if (t.status !== "successful" || t.direction !== "out" || t.serviceSlug !== slug) continue;
    const hit = svc.providers.find(
      (p) =>
        t.service.toLowerCase().includes(p.toLowerCase()) ||
        t.title.toLowerCase().includes(p.toLowerCase()),
    );
    if (hit) return hit;
  }
  return null;
}
