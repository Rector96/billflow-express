import { useMemo, useState } from "react";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export type DataPlanItem = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice?: boolean;
};

type TabId = "best" | "daily" | "weekly" | "monthly" | "all";

const TABS: { id: TabId; label: string }[] = [
  { id: "best", label: "Best Offers" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "all", label: "All" },
];

function classifyPlan(name: string): Exclude<TabId, "best" | "all"> | "other" {
  const n = name.toLowerCase();
  if (/(daily|1\s*day|24\s*hours|24hrs|night)/.test(n)) return "daily";
  if (/(weekly|7\s*days|7days|14\s*days)/.test(n)) return "weekly";
  if (/(monthly|30\s*days|30days|1\s*month)/.test(n)) return "monthly";
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

type Props = {
  plans: DataPlanItem[];
  selectedCode?: string | null;
  networkLabel?: string;
  phoneLabel?: string;
  onSelect: (plan: DataPlanItem) => void;
};

export function DataPlanPicker({
  plans,
  selectedCode,
  networkLabel,
  phoneLabel,
  onSelect,
}: Props) {
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

  const visible = useMemo(() => {
    if (tab === "best") return buckets.best.length ? buckets.best : buckets.all.slice(0, 9);
    if (tab === "daily") return buckets.daily.length ? buckets.daily : buckets.all;
    if (tab === "weekly") return buckets.weekly.length ? buckets.weekly : buckets.all;
    if (tab === "monthly") return buckets.monthly.length ? buckets.monthly : buckets.all;
    return buckets.all;
  }, [tab, buckets]);

  return (
    <div className="space-y-4">
      {(networkLabel || phoneLabel) && (
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-3.5 py-3 shadow-sm">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black uppercase tracking-wide text-primary">
            {(networkLabel || "NET").slice(0, 3)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {networkLabel || "Network"}
            </p>
            <p className="truncate text-base font-bold tabular-nums tracking-tight text-foreground">
              {phoneLabel || "—"}
            </p>
          </div>
        </div>
      )}

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                "relative shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors duration-200 " +
                (active ? "text-primary" : "text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
              <span
                className={
                  "absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-primary transition-opacity duration-200 " +
                  (active ? "opacity-100" : "opacity-0")
                }
              />
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          No plans in this category.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {visible.map((p) => {
            const selected = selectedCode === p.variationCode;
            const size = planSizeLabel(p.name);
            const duration = planDurationLabel(p.name);
            const title = cardTitle(p.name);

            return (
              <button
                key={p.variationCode}
                type="button"
                onClick={() => onSelect(p)}
                className={
                  "flex min-h-[132px] flex-col items-stretch overflow-hidden rounded-2xl border p-3 text-left " +
                  "transition-all duration-200 ease-out active:scale-[0.97] " +
                  (selected
                    ? "border-primary bg-primary/[0.08] shadow-sm ring-1 ring-primary/30"
                    : "border-border/50 bg-[#F4F2F8] hover:border-primary/30 hover:bg-[#EEEAF6]")
                }
              >
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {duration ?? "PLAN"}
                </p>
                <p
                  className={
                    "mt-1.5 truncate text-[17px] font-black leading-none tracking-tight sm:text-[18px] " +
                    (selected ? "text-primary" : "text-foreground")
                  }
                >
                  {title}
                </p>
                {!size ? (
                  <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                    {p.name}
                  </p>
                ) : (
                  <span className="mt-1 block h-0 grow" />
                )}
                <div className="mt-auto pt-2">
                  <p className="truncate text-[15px] font-extrabold tabular-nums leading-none text-foreground sm:text-[16px]">
                    {formatNaira(p.amount, false)}
                  </p>
                  <p
                    className={
                      "mt-1 text-[10px] font-bold transition-opacity duration-200 " +
                      (selected ? "text-primary opacity-100" : "opacity-0")
                    }
                  >
                    Selected
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="pt-1 text-center text-[12px] text-muted-foreground/60">— End —</p>
    </div>
  );
}
