/** Pure helpers for RockPay ↔ provider reconciliation (no money logic). */

export type RockPayStatus = "successful" | "pending" | "failed" | string;

export type ReconcileVerdict =
  | "reconciled"
  | "action_required"
  | "pending"
  | "unknown";

export function normalizeProviderStatus(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

/** Compare RockPay ledger status with provider delivery status. */
export function reconcileVerdict(
  rockpayStatus: RockPayStatus,
  providerStatus: string | null | undefined,
  providerCode?: string | null,
): ReconcileVerdict {
  const rp = String(rockpayStatus ?? "").toLowerCase();
  const ps = normalizeProviderStatus(providerStatus);
  const code = String(providerCode ?? "").trim();

  const providerOk =
    ps === "delivered" || ps === "success" || ps === "successful" || (code === "000" && ps === "delivered");
  const providerFail = ps === "failed" || ps === "fail";

  if (rp === "successful" && (providerOk || !ps)) return "reconciled";
  if (rp === "failed" && (providerFail || !ps)) return "reconciled";
  if (rp === "pending") {
    if (providerOk) return "action_required";
    if (providerFail) return "action_required";
    return "pending";
  }
  if (rp === "successful" && providerFail) return "action_required";
  if (rp === "failed" && providerOk) return "action_required";
  if (!ps && !code) return "unknown";
  return "reconciled";
}

export function reconcileLabel(v: ReconcileVerdict): string {
  switch (v) {
    case "reconciled":
      return "Reconciled";
    case "action_required":
      return "Action required";
    case "pending":
      return "Pending provider";
    default:
      return "Unknown";
  }
}

export function formatPendingDuration(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs} hr`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export type TimelineStep = {
  key: string;
  label: string;
  at: string | null;
  done: boolean;
};

/**
 * Build a simple timeline from REAL timestamps only.
 * We only have created_at / updated_at on bill rows today — no fabricated mid-events.
 */
export function buildBillTimeline(input: {
  createdAt: string;
  updatedAt?: string | null;
  status: string;
  hasProviderRequestId: boolean;
  providerStatus?: string | null;
}): TimelineStep[] {
  const created = input.createdAt;
  const updated = input.updatedAt && input.updatedAt !== input.createdAt ? input.updatedAt : null;
  const final = input.status === "successful" || input.status === "failed";

  return [
    { key: "initiated", label: "Payment initiated", at: created, done: true },
    {
      key: "debit",
      label: "Wallet debit recorded",
      at: created,
      done: true,
    },
    {
      key: "sent",
      label: "Sent to provider",
      at: input.hasProviderRequestId ? created : null,
      done: input.hasProviderRequestId,
    },
    {
      key: "response",
      label: input.providerStatus
        ? `Provider: ${input.providerStatus}`
        : "Awaiting provider response",
      at: updated ?? (input.providerStatus ? created : null),
      done: Boolean(input.providerStatus) || final,
    },
    {
      key: "final",
      label:
        input.status === "successful"
          ? "Successful"
          : input.status === "failed"
            ? "Failed"
            : "Pending confirmation",
      at: final ? updated ?? created : null,
      done: final,
    },
  ];
}
