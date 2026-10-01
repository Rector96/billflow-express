// @ts-nocheck -- generated DB types are out of date with the live schema; re-enable after regenerating types.
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export type DataPlanItem = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice?: boolean;
};

type TabId = "best" | "daily" | "weekly" | "monthly" | "special" | "all";

const TABS: { id: TabId; label: string }[] = [
  { id: "best", label: "Best Offers" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "special", label: "Special" },
  { id: "all", label: "All" },
];

function classifyPlan(name: string): Exclude<TabId, "best" | "all"> | "other" {
  const n = name.toLowerCase();
  if (/(night|social|whatsapp|youtube|instagram|tiktok|facebook|weekend|hourly)/.test(n)) {
    return "special";
  }
  if (/(daily|1\s*day|24\s*hours|24hrs)/.test(n)) return "daily";
  if (/(weekly|7\s*days|7days|14\s*days)/.test(n)) return "weekly";
  if (/(monthly|30\s*days|30days|1\s*month|40\s*days|45\s*days)/.test(n)) return "monthly";
  if (/\b[1-3]\s*days?\b/.test(n)) return "daily";
  if (/\b([4-9]|1[0-5])\s*days?\b/.test(n)) return "weekly";
  if (/\b([2-9][0-9]|1[6-9])\s*days?\b/.test(n)) return "monthly";
  return "other";
}

export function planSizeLabel(name: string): string | null {
  const m = name.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i);
  if (!m?.[1] || !m[2]) return null;
  return `${m[1]}${m[2].toUpperCase()}`;
}

export function planDurationLabel(name: string): string | null {
  const n = name.toLowerCase();
  if (/night/.test(n)) return "NIGHT";
  if (/(daily|1\s*day|24\s*h)/.test(n)) return "1 DAY";
  const days = n.match(/(\d+)\s*days?/);
  if (days?.[1]) return `${days[1]} DAYS`;
  if (/weekly|7\s*day/.test(n)) return "7 DAYS";
  if (/monthly|30\s*day|1\s*month/.test(n)) return "30 DAYS";
  return null;
}

function cardTitle(name: string): string {
  const size = planSizeLabel(name);
  if (size) return size;
  const cleaned = name
    .replace(/\b(MTN|GLO|AIRTEL|9MOBILE|SMILE|DATA)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (cleaned.length <= 12) return cleaned || "Data";
  return `${cleaned.slice(0, 11)}…`;
}

function planTypeLabel(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("sme")) return "SME";
  if (/(corporate|gifting)/.test(n)) return "GIFTING";
  if (/(social|whatsapp|youtube|instagram|tiktok|facebook)/.test(n)) return "SOCIAL";
  if (n.includes("night")) return "NIGHT";
  return "DATA";
}

type Props = {
  plans: DataPlanItem[];
  selectedCode?: string | null;
  networkLabel?: string;
  phoneLabel?: string;
  onSelect: (plan: DataPlanItem) => void;
};

export function DataPlanPicker({ plans, selectedCode, networkLabel, phoneLabel, onSelect }: Props) {
  const buckets = useMemo(() => {
    const daily: DataPlanItem[] = [];
    const weekly: DataPlanItem[] = [];
    const monthly: DataPlanItem[] = [];
    const other: DataPlanItem[] = [];
    for (const p of plans) {
      const c = classifyPlan(p.name);
      if (c === "daily") daily.push(p);
      else if (c === "weekly") weekly.push(p);
      else if (c === "monthly") monthly.push(p);
      else other.push(p);
    }
    const byAmount = (a: DataPlanItem, b: DataPlanItem) => a.amount - b.amount;
    daily.sort(byAmount);
    weekly.sort(byAmount);
    monthly.sort(byAmount);
    other.sort(byAmount);
    const bestPool = [
      ...daily.slice(0, 3),
      ...weekly.slice(0, 3),
      ...monthly.slice(0, 3),
      ...other.slice(0, 2),
    ];
    const best = bestPool
      .filter((p, i, arr) => arr.findIndex((x) => x.variationCode === p.variationCode) === i)
      .sort(byAmount)
      .slice(0, 9);
    return { daily, weekly, monthly, other, best, all: [...plans].sort(byAmount) };
  }, [plans]);

  const [tab, setTab] = useState<TabId>("best");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const source =
      tab === "best"
        ? buckets.best.length
          ? buckets.best
          : buckets.all.slice(0, 9)
        : tab === "daily"
          ? buckets.daily
          : tab === "weekly"
            ? buckets.weekly
            : tab === "monthly"
              ? buckets.monthly
              : tab === "special"
                ? buckets.other
                : buckets.all;
    const needle = query.trim().toLowerCase();
    return needle
      ? source.filter((plan) => `${plan.name} ${plan.amount}`.toLowerCase().includes(needle))
      : source;
  }, [tab, buckets, query]);

  return (
    <div className="space-y-3.5">
      {(networkLabel || phoneLabel) && (
        <div className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-3.5 text-primary-foreground shadow-float">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-foreground/15 text-xs font-black uppercase">
            {(networkLabel || "NET").slice(0, 3)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase opacity-70">
              {networkLabel || "Network"}
            </p>
            <p className="truncate text-base font-bold tabular-nums">{phoneLabel || "—"}</p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search plans"
          aria-label="Search data plans"
          className="h-11 rounded-xl border-border/70 bg-card pl-10 shadow-soft"
        />
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "relative shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200",
                active
                  ? "bg-primary-soft text-primary shadow-soft"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          No plans in this category.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {visible.map((p, index) => {
            const selected = selectedCode === p.variationCode;
            const size = planSizeLabel(p.name);
            const duration = planDurationLabel(p.name);
            const title = cardTitle(p.name);

            return (
              <motion.div
                key={p.variationCode}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18, delay: Math.min(index, 5) * 0.025 }}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onSelect(p)}
                  className={
                    "relative flex min-h-[116px] flex-col items-stretch overflow-hidden rounded-xl border p-2.5 text-left " +
                    "transition-all duration-200 ease-out active:scale-[0.97] " +
                    (selected
                      ? "border-primary bg-primary/[0.08] shadow-sm ring-1 ring-primary/30"
                      : "border-border/60 bg-card hover:border-primary/30 hover:bg-primary-soft/40")
                  }
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-[9px] font-bold uppercase text-muted-foreground">
                      {duration ?? "PLAN"}
                    </p>
                    {selected ? (
                      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-2.5" />
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={
                      "mt-1.5 truncate text-base font-black leading-none sm:text-[17px] " +
                      (selected ? "text-primary" : "text-foreground")
                    }
                  >
                    {title}
                  </p>
                  {!size ? (
                    <p className="mt-1 line-clamp-2 text-[9px] leading-tight text-muted-foreground">
                      {planTypeLabel(p.name)} · {p.name}
                    </p>
                  ) : (
                    <span className="mt-1 block h-0 grow" />
                  )}
                  <div className="mt-auto pt-2">
                    <p className="truncate text-sm font-extrabold tabular-nums leading-none text-foreground sm:text-[15px]">
                      {formatNaira(p.amount, false)}
                    </p>
                    <p className="mt-1 truncate text-[9px] font-semibold text-muted-foreground">
                      {planTypeLabel(p.name)}
                    </p>
                  </div>
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="pt-1 text-center text-[11px] font-medium text-muted-foreground">
        {visible.length} {visible.length === 1 ? "plan" : "plans"}
      </p>
    </div>
  );
}
