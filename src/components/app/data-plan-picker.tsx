import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
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

function classifyPlan(name: string): TabId {
  const n = name.toLowerCase();
  if (/(daily|1\s*day|24\s*hours|24hrs|night)/.test(n)) return "daily";
  if (/(weekly|7\s*days|7days|14\s*days)/.test(n)) return "weekly";
  if (/(monthly|30\s*days|30days|1\s*month)/.test(n)) return "monthly";
  // fallback: short validity often daily
  if (/\b[1-3]\s*days?\b/.test(n)) return "daily";
  if (/\b([4-9]|1[0-5])\s*days?\b/.test(n)) return "weekly";
  if (/\b([2-9][0-9]|1[6-9])\s*days?\b/.test(n)) return "monthly";
  return "all";
}

/** Extract a short data size label e.g. 1.5GB from plan name. */
export function planSizeLabel(name: string): string | null {
  const m = name.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i);
  if (!m) return null;
  return `${m[1]}${m[2].toUpperCase()}`;
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
    // Best = cheapest per size-ish: take lowest 6 overall
    const best = [...plans].sort((a, b) => a.amount - b.amount).slice(0, 9);
    return { daily, weekly, monthly, other, best, all: plans };
  }, [plans]);

  const availableTabs = TABS.filter((t) => {
    if (t.id === "all") return true;
    if (t.id === "best") return buckets.best.length > 0;
    return buckets[t.id].length > 0;
  });

  const defaultTab =
    availableTabs.find((t) => t.id === "weekly")?.id ??
    availableTabs.find((t) => t.id === "best")?.id ??
    availableTabs[0]?.id ??
    "all";

  const [tab, setTab] = useState<TabId>(defaultTab);

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
    <div className="space-y-4">
      {/* Header: network + number */}
      {(networkLabel || phoneLabel) && (
        <div className="rounded-2xl border border-border/60 bg-card px-3.5 py-3 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-extrabold text-primary">
              {(networkLabel || "D").slice(0, 3).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-extrabold tracking-tight text-foreground">
                {phoneLabel || "—"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {networkLabel ? `${networkLabel} data plans` : "Choose a plan"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-max gap-1 border-b border-border/50">
          {availableTabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative px-3 py-2.5 text-sm font-semibold transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary transition-all duration-200",
                    active ? "opacity-100 scale-x-100" : "opacity-0 scale-x-50",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Plan grid */}
      <div
        key={tab}
        className="grid grid-cols-3 gap-2.5 animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
      >
        {list.length === 0 ? (
          <p className="col-span-3 py-8 text-center text-xs text-muted-foreground">
            No plans in this category.
          </p>
        ) : (
          list.map((p) => {
            const selected = selectedCode === p.variationCode;
            const size = planSizeLabel(p.name);
            const duration = planDurationLabel(p.name);
            return (
              <button
                key={p.variationCode}
                type="button"
                onClick={() => onSelect(p)}
                className={cn(
                  "press relative flex min-h-[6.5rem] flex-col items-stretch justify-between rounded-2xl border px-2.5 py-2.5 text-left transition-all duration-200",
                  selected
                    ? "border-primary bg-primary-soft shadow-soft ring-2 ring-primary/15"
                    : "border-border/60 bg-card/80 hover:border-primary/35 hover:bg-card",
                )}
              >
                {selected ? (
                  <span className="absolute top-1.5 right-1.5 text-primary">
                    <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
                  </span>
                ) : null}
                <div>
                  {duration ? (
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {duration}
                    </p>
                  ) : (
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      Plan
                    </p>
                  )}
                  <p className="mt-1 text-[15px] font-extrabold leading-tight text-foreground">
                    {size || p.name.split(/[-–|]/)[0]?.trim().slice(0, 12) || "Data"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-extrabold tabular-nums text-foreground">
                    {formatNaira(p.amount, false)}
                  </p>
                  {!size ? (
                    <p className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-muted-foreground">
                      {p.name}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>

      <p className="text-center text-[10px] text-muted-foreground">— End —</p>
    </div>
  );
}
