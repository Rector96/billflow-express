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
  { id: "best", label: "Best" },
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
    <div className="space-y-3">
      <style>{`
        @keyframes rpFadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {(networkLabel || phoneLabel) && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-muted/40 px-3 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold tracking-wide text-primary-foreground">
            {(networkLabel || "NET").slice(0, 3).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              {phoneLabel || "—"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {networkLabel ? `${networkLabel} · data` : "Choose a plan"}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="flex min-w-max items-end border-b border-border/40">
          {availableTabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative px-3 pb-2 pt-1 text-[12px] font-medium transition-colors duration-200",
                  active ? "text-foreground" : "text-muted-foreground/80",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "pointer-events-none absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-foreground transition-transform duration-300 ease-out",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div
        key={tab}
        className="grid grid-cols-3 gap-2"
        style={{ animation: "rpFadeSlide 220ms ease-out" }}
      >
        {list.length === 0 ? (
          <p className="col-span-3 py-10 text-center text-[11px] text-muted-foreground">
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
                  "relative flex aspect-[0.92] flex-col justify-between overflow-hidden rounded-[14px] border px-2 py-2 text-left",
                  "transition-[border-color,background-color,box-shadow,transform] duration-300 ease-out",
                  "active:scale-[0.97]",
                  selected
                    ? "border-primary/50 bg-primary/[0.07] shadow-[0_0_0_1px_rgba(109,40,217,0.12)]"
                    : "border-transparent bg-[#F3F1F8] hover:border-primary/25 hover:bg-[#EFEAF8]",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-x-0 top-0 h-[2px] bg-primary transition-opacity duration-300",
                    selected ? "opacity-100" : "opacity-0",
                  )}
                />

                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
                    {duration ?? "PLAN"}
                  </p>
                  <p
                    className={cn(
                      "mt-1 truncate text-[13px] font-bold leading-none tracking-tight",
                      "transition-colors duration-300",
                      selected ? "text-primary" : "text-foreground",
                    )}
                  >
                    {title}
                  </p>
                  {!size ? (
                    <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-muted-foreground/80">
                      {p.name}
                    </p>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold tabular-nums leading-none text-foreground">
                    {formatNaira(p.amount, false)}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[9px] font-semibold transition-opacity duration-300",
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

      <p className="pt-0.5 text-center text-[10px] text-muted-foreground/70">— End —</p>
    </div>
  );
}
