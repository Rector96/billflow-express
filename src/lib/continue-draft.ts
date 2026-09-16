/**
 * Lightweight local drafts for "Continue where you left off" on Home.
 * Not a server source of truth — only UX continuity until hub applications persist in DB.
 */
export type ContinueDraft = {
  id: string;
  serviceSlug: string;
  title: string;
  stepLabel: string;
  step: number;
  totalSteps: number;
  href: string;
  updatedAt: number;
};

const KEY = "rockpay_continue_drafts_v1";

export function readContinueDrafts(): ContinueDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ContinueDraft[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d) => d && typeof d.href === "string" && typeof d.title === "string")
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function saveContinueDraft(draft: Omit<ContinueDraft, "updatedAt"> & { updatedAt?: number }) {
  if (typeof window === "undefined") return;
  try {
    const prev = readContinueDrafts().filter((d) => d.id !== draft.id);
    const next: ContinueDraft[] = [
      { ...draft, updatedAt: draft.updatedAt ?? Date.now() },
      ...prev,
    ].slice(0, 5);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function clearContinueDraft(id: string) {
  if (typeof window === "undefined") return;
  try {
    const next = readContinueDrafts().filter((d) => d.id !== id);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
