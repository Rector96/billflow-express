import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ReceiptText,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState, StatusBadge } from "@/components/app/ui-bits";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { formatNaira } from "@/lib/mock-data";
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
  if (key === "month")
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (key === "last_month") {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  }
  return true;
}

function dayLabel(tx: Transaction): string {
  const ts = parseTxTime(tx);
  if (!ts) return tx.date;
  const now = new Date();
  const startOf = (y: number, m: number, day: number) => new Date(y, m, day).getTime();
  const today0 = startOf(now.getFullYear(), now.getMonth(), now.getDate());
  if (ts >= today0) return "Today";
  if (ts >= today0 - 86_400_000) return "Yesterday";
  return new Date(ts).toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
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
        "press h-7.5 shrink-0 rounded-full px-3 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-card text-muted-foreground border border-border/80 hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function ModernRow({ tx }: { tx: Transaction }) {
  const inbound = tx.direction === "in";
  return (
    <Link
      to="/history/$txId"
      params={{ txId: tx.id }}
      className="press flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary-soft/30"
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-2xl",
          inbound
            ? "bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 text-emerald-600"
            : "bg-gradient-to-br from-primary/15 to-fuchsia-500/15 text-primary",
        )}
      >
        {inbound ? (
          <ArrowDownLeft className="size-4.5" strokeWidth={2} />
        ) : (
          <ArrowUpRight className="size-4.5" strokeWidth={2} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{tx.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {tx.service} · {tx.time}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-sm font-bold tabular-nums",
            inbound ? "text-emerald-600" : "text-foreground",
          )}
        >
          {inbound ? "+" : "-"}
          {formatNaira(tx.amount, false)}
        </p>
        <div className="mt-1 flex justify-end">
          <StatusBadge status={tx.status} compact />
        </div>
      </div>
    </Link>
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
        const hay =
          `${t.title} ${t.service} ${t.id} ${t.amount} ${t.reference ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [transactions, status, category, dateKey, q]);

  const totals = useMemo(() => {
    let inn = 0;
    let out = 0;
    for (const t of list) {
      if (t.status !== "successful") continue;
      if (t.direction === "in") inn += t.amount;
      else out += t.amount;
    }
    return { inn, out };
  }, [list]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of list) {
      const label = dayLabel(tx);
      const arr = map.get(label);
      if (arr) arr.push(tx);
      else map.set(label, [tx]);
    }
    return [...map.entries()];
  }, [list]);

  const extraActive = category !== "all" || dateKey !== "all";

  return (
    <AppShell>
      {/* Gradient header with search */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-violet-600 to-fuchsia-600" />
        <div className="absolute -top-14 right-0 size-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-6 size-44 rounded-full bg-fuchsia-300/20 blur-2xl" />
        <div className="relative px-4 pt-5 pb-12">
          <h1 className="text-xl font-bold tracking-tight text-white">Transactions</h1>
          <p className="mt-0.5 text-xs text-white/70">
            Every payment and top-up, all in one place.
          </p>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, reference or amount..."
              aria-label="Search transactions"
              className="h-11 rounded-xl border-white/20 bg-white/95 pl-10 text-sm shadow-lg placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>

      <div className="relative -mt-6 space-y-3 rounded-t-3xl bg-gradient-to-b from-violet-50 via-background to-background px-4 pt-4 pb-6">
        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card p-3 shadow-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/25 text-emerald-600">
              <TrendingUp className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Money in
              </p>
              <p className="truncate text-sm font-bold text-emerald-600 tabular-nums">
                {formatNaira(totals.inn, false)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card p-3 shadow-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-fuchsia-500/20 text-primary">
              <TrendingDown className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Money out
              </p>
              <p className="truncate text-sm font-bold tabular-nums">
                {formatNaira(totals.out, false)}
              </p>
            </div>
          </div>
        </div>

        {/* Status chips + more filters */}
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              "press grid size-7.5 shrink-0 place-items-center rounded-full border transition-colors",
              moreOpen || extraActive
                ? "border-primary bg-primary-soft text-primary"
                : "border-border/80 bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            <SlidersHorizontal className="size-3.5" />
          </button>
        </div>

        {moreOpen ? (
          <div className="space-y-2.5 rounded-2xl border border-border/80 bg-card p-3.5 shadow-card">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
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
              <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
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
                className="text-xs font-medium text-primary hover:text-primary-deep transition-colors"
                onClick={() => {
                  setCategory("all");
                  setDateKey("all");
                }}
              >
                Reset filters
              </button>
            ) : null}
          </div>
        ) : null}

        {list.length ? (
          <div className="space-y-4">
            {groups.map(([label, txs]) => (
              <section key={label}>
                <p className="mb-1.5 px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {label}
                </p>
                <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
                  {txs.map((tx) => (
                    <ModernRow key={tx.id} tx={tx} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            Icon={ReceiptText}
            title="No matching transactions"
            body="Try another search term or filter status."
          />
        )}
      </div>
    </AppShell>
  );
}
