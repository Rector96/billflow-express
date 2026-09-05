import { getService, type SavedPayment, type ServiceSlug, type Transaction } from "@/lib/mock-data";

export type BuyAgainItem = {
  key: string;
  serviceSlug: ServiceSlug | string;
  provider: string;
  amount: number;
  label: string;
  /** Saved payment id when a matching favorite exists — preferred path for full prefill */
  savedId?: string;
  identifier?: string;
  score: number;
};

function extractProvider(tx: Transaction): string {
  const svc = getService(tx.serviceSlug);
  if (svc) {
    const hit = svc.providers.find(
      (p) =>
        tx.service.toLowerCase().includes(p.toLowerCase()) ||
        tx.title.toLowerCase().includes(p.toLowerCase()),
    );
    if (hit) return hit;
  }
  // "MTN Data" / "AEDC Electricity" → first token often is provider
  const first = tx.service.trim().split(/\s+/)[0];
  return first || "";
}

/**
 * Rank successful outbound payments for "Buy Again".
 * Uses only the authenticated user's transaction list (already RLS-scoped).
 * Prefers matching saved payments so identifier can be prefilled safely.
 */
export function buildBuyAgain(
  transactions: Transaction[],
  saved: SavedPayment[],
  limit = 3,
): BuyAgainItem[] {
  const successful = transactions.filter(
    (t) =>
      t.status === "successful" &&
      t.direction === "out" &&
      t.serviceSlug &&
      t.serviceSlug !== "wallet",
  );

  type Acc = {
    key: string;
    serviceSlug: string;
    provider: string;
    amount: number;
    label: string;
    count: number;
    lastAt: number;
  };

  const map = new Map<string, Acc>();

  for (const tx of successful) {
    const provider = extractProvider(tx);
    const amount = Math.round(tx.amount);
    const key = `${tx.serviceSlug}|${provider}|${amount}`;
    const when = Date.parse(`${tx.date} ${tx.time}`) || Date.now();
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastAt = Math.max(existing.lastAt, when);
    } else {
      const svc = getService(tx.serviceSlug);
      const label =
        provider && svc
          ? `${provider} ${svc.short}`
          : tx.title || tx.service || svc?.short || "Payment";
      map.set(key, {
        key,
        serviceSlug: tx.serviceSlug,
        provider,
        amount,
        label,
        count: 1,
        lastAt: when,
      });
    }
  }

  const now = Date.now();
  const scored: BuyAgainItem[] = [...map.values()].map((a) => {
    const daysAgo = Math.max(0, (now - a.lastAt) / 86_400_000);
    const recency = Math.max(0, 30 - daysAgo) / 30; // 0..1 over ~30 days
    const frequency = Math.min(a.count, 10) / 10;
    const score = frequency * 0.55 + recency * 0.45;

    const match = saved.find(
      (s) =>
        s.serviceSlug === a.serviceSlug &&
        (!a.provider || s.provider.toLowerCase() === a.provider.toLowerCase()),
    );

    return {
      key: a.key,
      serviceSlug: a.serviceSlug,
      provider: a.provider || match?.provider || "",
      amount: a.amount,
      label: match?.label || a.label,
      ...(match ? { savedId: match.id, identifier: match.identifier } : {}),
      score,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
