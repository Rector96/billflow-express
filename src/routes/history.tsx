import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ReceiptText, Search, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, TransactionRow } from "@/components/app/ui-bits";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { Transaction, TxStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: `Transactions — ${BRAND.name}` },
      { name: "description", content: "Every payment and top-up, filtered by status." },
      { property: "og:title", content: `Transactions — ${BRAND.name}` },
      { property: "og:description", content: "Track successful, pending and failed payments." },
    ],
  }),
  component: HistoryLayout,
});

function HistoryLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/history") return <Outlet />;
  return <HistoryPage />;
}

type StatusKey = "all" | TxStatus;
type CategoryKey = "all" | "airtime" | "data" | "electricity" | "cable" | "other";
type DateKey = "all" | "today" | "yesterday" | "7d" | "month" | "last_month";

const STATUS: Array<{ key: StatusKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "successful", label: "Successful" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
];

const CATEGORY: Array<{ key: CategoryKey; label: string }> = [
  { key: "all", label: "All services" },
  { key: "airtime", label: "Airtime" },
  { key: "data", label: "Data" },
  { key: "electricity", label: "Electricity" },
  { key: "cable", label: "Cable" },
  { key: "other", label: "Other" },
];

const DATES: Array<{ key: DateKey; label: string }> = [
  { key: "all", label: "Any time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
];

function parseTxTime(tx: Transaction): number {
  const t = Date.parse(`${tx.date} ${tx.time}`);
  return Number.isFinite(t) ? t : 0;
}

function categoryOf(tx: Transaction): CategoryKey {
  const s = (tx.serviceSlug || "").toLowerCase();
  if (s === "airtime") return "airtime";
  if (s === "data") return "data";
  if (s === "electricity") return "electricity";
  if (s === "cable") return "cable";
  return "other";
}

function inDateRange(tx: Transaction, key: DateKey): boolean {
  if (key === "all") return true;
  const ts = parseTxTime(tx);
  if (!ts) return true;
  const d = new Date(ts);
  const now = new Date();
  const startOf = (y: number, m: number, day: number) => new Date(y, m, day).getTime();
  const today0 = startOf(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === "today") return ts >= today0;
  if (key === "yesterday") return ts >= today0 - 86_400_000 && ts < today0;
  if (key === "7d") return ts >= today0 - 6 * 86_400_000;
  if (key === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (key === "last_month") {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  }
  return true;
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press h-8 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-soft"
          : "bg-muted/80 text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function HistoryPage() {
  const { transactions } = useApp();
  const [status, setStatus] = useState<StatusKey>("all");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [dateKey, setDateKey] = useState<DateKey>("all");
  const [q, setQ] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return transactions.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (category !== "all" && categoryOf(t) !== category) return false;
      if (!inDateRange(t, dateKey)) return false;
      if (needle) {
        const hay = `${t.title} ${t.service} ${t.id} ${t.amount} ${t.reference ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [transactions, status, category, dateKey, q]);

  const extraActive = category !== "all" || dateKey !== "all";

  return (
    <AppShell>
      <PageHeader title="History" backTo="/home" />
      <div className="space-y-3 px-4 pt-1 pb-6">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search transactions"
            aria-label="Search transactions"
            className="h-11 rounded-2xl border-border/60 bg-card pl-10 text-sm shadow-soft"
          />
        </div>

        {/* Primary status row — matches mock: All | Successful | Pending | Failed */}
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STATUS.map((t) => (
              <Chip key={t.key} active={status === t.key} onClick={() => setStatus(t.key)}>
                {t.label}
              </Chip>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-label="More filters"
            className={cn(
              "press grid size-9 shrink-0 place-items-center rounded-full border",
              moreOpen || extraActive
                ? "border-primary bg-primary-soft text-primary"
                : "border-border/70 bg-card text-muted-foreground",
            )}
          >
            <SlidersHorizontal className="size-4" />
          </button>
        </div>

        {/* Secondary filters — collapsed by default to avoid scatter */}
        {moreOpen ? (
          <div className="space-y-2.5 rounded-2xl border border-border/60 bg-card p-3 shadow-soft">
            <div>
              <p className="mb-1.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                Service
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY.map((t) => (
                  <Chip key={t.key} active={category === t.key} onClick={() => setCategory(t.key)}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                Date
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DATES.map((t) => (
                  <Chip key={t.key} active={dateKey === t.key} onClick={() => setDateKey(t.key)}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </div>
            {extraActive ? (
              <button
                type="button"
                className="text-xs font-bold text-primary"
                onClick={() => {
                  setCategory("all");
                  setDateKey("all");
                }}
              >
                Clear service & date filters
              </button>
            ) : null}
          </div>
        ) : null}

        {list.length ? (
          <div className="space-y-2">
            {list.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        ) : (
          <EmptyState
            Icon={ReceiptText}
            title="No matching transactions"
            body="Try another status or open filters for service and date."
          />
        )}
      </div>
    </AppShell>
  );
}
