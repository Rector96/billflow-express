import { useEffect, useMemo, useState } from "react";
import { Check, Smartphone } from "lucide-react";
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
  { id: "best", label: "Best offers" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "all", label: "All" },
];

function classifyPlan(name: string): TabId {
  const n = name.toLowerCase();
  if (/(daily|1\s*day|24\s*hours|24hrs|night)/.test(n)) return "daily";
  if (/(weekly|7\s*days|7days|14\s*days)/.test(n)) return "weekly";
  if (/(monthly|30\s*days|30days|1\s*month)/.test(n)) return "monthly";
  if (/\b[1-3]\s*days?\b/.test(n)) return "daily";
  if (/\b([4-9]|1[0-5])\s*days?\b/.test(n)) return "weekly";
  if (/\b([2-9][0-9]|1[6-9])\s*days?\b/.test(n)) return "monthly";
  return "all";
}

export function planSizeLabel(name: string): string | null {
  const m = name.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i);
  if (!m) return null;
  return `${m[1]}${(m[2] ?? "").toUpperCase()}`;
}

export function planDurationLabel(name: string): string | null {
  const n = name.toLowerCase();
  if (/night/.test(n)) return "NIGHT";
  if (/(daily|1\s*day|24\s*h)/.test(n)) return "1 DAY";
  const days = n.match(/(\d+)\s*days?/);
  if (days) return `${days[1]} DAYS`;
  if (/weekly|7\s*day/.test(n)) return "7 DAYS";
  if (/monthly|30\s*day|1\s*month/.test(n)) return "30 DAYS";
  return null;
}

function cardTitle(name: string): string {
  const size = planSizeLabel(name);
  if (size) return size;
  const cleaned = name
    .replace(/\b(MTN|GLO|AIRTEL|9MOBILE|SMILE)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned.length > 14 ? `${cleaned.slice(0, 13)}…` : cleaned || "Data";
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
    for (const p of plans) {
      const c = classifyPlan(p.name);
      if (c === "daily") daily.push(p);
      else if (c === "weekly") weekly.push(p);
      else if (c === "monthly") monthly.push(p);
    }
    const best = [...plans].sort((a, b) => a.amount - b.amount).slice(0, 9);
    return { daily, weekly, monthly, best, all: plans };
  }, [plans]);

  const availableTabs = TABS.filter((t) => {
    if (t.id === "all") return plans.length > 0;
    if (t.id === "best") return buckets.best.length > 0;
    return buckets[t.id as "daily" | "weekly" | "monthly"].length > 0;
  });

  const defaultTab =
    availableTabs.find((t) => t.id === "weekly")?.id ??
    availableTabs.find((t) => t.id === "best")?.id ??
    availableTabs[0]?.id ??
    "all";

  const [tab, setTab] = useState<TabId>(defaultTab);

  useEffect(() => {
    if (!availableTabs.some((item) => item.id === tab)) setTab(defaultTab);
  }, [availableTabs, defaultTab, tab]);

  const list =
    tab === "best"
      ? buckets.best
      : tab === "daily"
        ? buckets.daily
        : tab === "weekly"
          ? buckets.weekly
          : tab === "monthly"
            ? buckets.monthly
            : buckets.all;

  return (
    <div className="space-y-5">
      {(networkLabel || phoneLabel) && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-primary-soft/70 px-3.5 py-3 shadow-soft">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-[10px] font-bold uppercase text-primary-foreground shadow-sm">
            {(networkLabel || "NET").slice(0, 3).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-base font-bold text-foreground">
              {phoneLabel || "—"}
            </p>
            <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <Smartphone className="size-3" />
              {networkLabel ? `${networkLabel} data` : "Choose a plan"}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto pb-1 [scrollbar-width:none]">
        <div className="flex min-w-max gap-1 rounded-xl bg-secondary p-1">
          {availableTabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200",
                  active
                    ? "bg-card text-primary shadow-pill"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        key={tab}
        className="plan-enter grid grid-cols-2 gap-3"
      >
        {list.length === 0 ? (
          <p className="col-span-2 py-10 text-center text-xs text-muted-foreground">
            No plans in this category
          </p>
        ) : (
          list.map((p) => {
            const selected = selectedCode === p.variationCode;
            const duration = planDurationLabel(p.name);
            const title = cardTitle(p.name);
            const size = planSizeLabel(p.name);

            return (
              <button
                key={p.variationCode}
                type="button"
                onClick={() => onSelect(p)}
                className={cn(
                   "relative flex min-h-32 flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left",
                  "transition-[border-color,background-color,box-shadow,transform] duration-300 ease-out",
                  "active:scale-[0.97]",
                  selected
                     ? "-translate-y-0.5 border-primary bg-primary-soft shadow-float"
                     : "border-border/70 bg-card shadow-soft hover:-translate-y-0.5 hover:border-primary/30",
                )}
              >
                <span className={cn("absolute right-3 top-3 grid size-5 place-items-center rounded-full border transition-all", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-transparent")}>
                  <Check className="size-3" strokeWidth={3} />
                </span>

                <div className="min-w-0">
                  <p className="pr-6 text-[10px] font-semibold uppercase text-muted-foreground">
                    {duration ?? "PLAN"}
                  </p>
                  <p
                    className={cn(
                       "mt-2 truncate text-xl font-bold leading-none",
                      "transition-colors duration-300",
                      selected ? "text-primary" : "text-foreground",
                    )}
                  >
                    {title}
                  </p>
                  {!size ? (
                     <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                      {p.name}
                    </p>
                  ) : null}
                </div>

                <div className="min-w-0">
                   <p className="truncate text-base font-bold tabular-nums leading-none text-foreground">
                    {formatNaira(p.amount, false)}
                  </p>
                  <p
                    className={cn(
                       "mt-1.5 text-[10px] font-semibold transition-opacity duration-300",
                      selected ? "text-primary opacity-100" : "opacity-0",
                    )}
                  >
                    Selected
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      <p className="pt-1 text-center text-[10px] text-muted-foreground/70">
        Prices and availability update from your network.
      </p>
    </div>
  );
}
