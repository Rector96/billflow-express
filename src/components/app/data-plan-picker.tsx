import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Search, Signal, Smartphone, Sparkles } from "lucide-react";
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

type TabId = "popular" | "daily" | "weekly" | "monthly" | "special" | "all";

const TABS: { id: TabId; label: string }[] = [
  { id: "popular", label: "Popular" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "special", label: "Special" },
  { id: "all", label: "All" },
];

function classifyPlan(name: string): TabId {
  const n = name.toLowerCase();
  if (/(night|social|whatsapp|youtube|instagram|tiktok|facebook|weekend|hourly)/.test(n)) {
    return "special";
  }
  if (/(daily|1\s*day|24\s*hours|24hrs)/.test(n)) return "daily";
  if (/(weekly|7\s*days|7days|14\s*days)/.test(n)) return "weekly";
  if (/(monthly|30\s*days|30days|1\s*month|40\s*days|45\s*days)/.test(n)) return "monthly";
  if (/\b[1-3]\s*days?\b/.test(n)) return "daily";
  if (/\b([4-9]|1[0-5])\s*days?\b/.test(n)) return "weekly";
  if (/\b(1[6-9]|[2-4][0-9])\s*days?\b/.test(n)) return "monthly";
  if (/(60|90|120|180|365)\s*days?|2\s*months?|3\s*months?|yearly/.test(n)) {
    return "special";
  }
  return "all";
}

export function planSizeLabel(name: string): string | null {
  const m = name.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i);
  if (!m) return null;
  const value = m[1];
  const unit = m[2];
  if (!value || !unit) return null;
  return `${value}${unit.toUpperCase()}`;
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
    const special: DataPlanItem[] = [];
    for (const p of plans) {
      const c = classifyPlan(p.name);
      if (c === "daily") daily.push(p);
      else if (c === "weekly") weekly.push(p);
      else if (c === "monthly") monthly.push(p);
      else if (c === "special") special.push(p);
    }
    const popular = plans.slice(0, 8);
    return { daily, weekly, monthly, special, popular, all: plans };
  }, [plans]);

  const availableTabs = TABS.filter((t) => {
    if (t.id === "all") return plans.length > 0;
    if (t.id === "popular") return buckets.popular.length > 0;
    return buckets[t.id as "daily" | "weekly" | "monthly" | "special"].length > 0;
  });

  const defaultTab =
    availableTabs.find((t) => t.id === "popular")?.id ??
    availableTabs[0]?.id ??
    "all";

  const [tab, setTab] = useState<TabId>(defaultTab);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!availableTabs.some((item) => item.id === tab)) setTab(defaultTab);
  }, [availableTabs, defaultTab, tab]);

  const categoryPlans =
    tab === "popular"
      ? buckets.popular
      : tab === "daily"
        ? buckets.daily
        : tab === "weekly"
          ? buckets.weekly
          : tab === "monthly"
            ? buckets.monthly
            : tab === "special"
              ? buckets.special
            : buckets.all;

  const normalizedQuery = query.trim().toLowerCase();
  const list = normalizedQuery
    ? plans.filter(
        (plan) =>
          plan.name.toLowerCase().includes(normalizedQuery) ||
          String(plan.amount).includes(normalizedQuery),
      )
    : categoryPlans;

  const displayNetwork = (networkLabel || "Your network")
    .replace(/data/gi, "")
    .replace(/-/g, " ")
    .trim();

  return (
    <div className="space-y-4">
      {(networkLabel || phoneLabel) && (
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-primary-soft p-4 shadow-card">
          <span className="pointer-events-none absolute -right-7 -top-8 size-24 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-[11px] font-bold uppercase text-primary-foreground shadow-card">
              {displayNetwork.slice(0, 3).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-base font-extrabold text-foreground">
                {phoneLabel || "—"}
              </p>
              <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <Smartphone className="size-3" />
                {displayNetwork} data · {plans.length} plans
              </p>
            </div>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card/80 text-primary shadow-soft">
              <Signal className="size-4" />
            </span>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by size, type or price"
          aria-label="Search data plans"
          className="h-11 rounded-xl border-border/70 bg-card pl-10 text-sm shadow-soft"
        />
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <div className="flex min-w-max gap-1.5">
          {availableTabs.map((t) => {
            const active = tab === t.id;
            return (
              <Button
                key={t.id}
                type="button"
                variant={active ? "default" : "secondary"}
                size="sm"
                onClick={() => {
                  setTab(t.id);
                  setQuery("");
                }}
                className={cn(
                  "relative h-9 rounded-full px-4 text-xs transition-all duration-200",
                  active ? "shadow-pill" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {t.id === "all" ? ` ${plans.length}` : ""}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-foreground">
            {normalizedQuery ? "Search results" : TABS.find((item) => item.id === tab)?.label} plans
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Tap a plan to select it</p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {list.length} {list.length === 1 ? "plan" : "plans"}
        </span>
      </div>

      <motion.div layout className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {list.length === 0 ? (
          <div className="col-span-3 rounded-2xl border border-dashed border-border bg-card py-10 text-center">
            <p className="text-sm font-bold text-foreground">No matching plan</p>
            <p className="mt-1 text-xs text-muted-foreground">Try another category or search term.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
          {list.map((p, index) => {
            const selected = selectedCode === p.variationCode;
            const duration = planDurationLabel(p.name);
            const title = cardTitle(p.name);
            const size = planSizeLabel(p.name);

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
                className={cn(
                  "relative h-full min-h-28 w-full whitespace-normal rounded-xl p-2.5 text-left sm:min-h-30 sm:p-3",
                  "flex flex-col items-stretch justify-between overflow-hidden",
                  "transition-[border-color,background-color,box-shadow,transform] duration-300 ease-out",
                  selected
                    ? "-translate-y-0.5 border-primary bg-primary-soft shadow-float ring-2 ring-primary/10"
                    : "border-border/70 bg-card shadow-soft hover:-translate-y-0.5 hover:border-primary/30",
                )}
              >
                <span className={cn("absolute right-2 top-2 grid size-4 place-items-center rounded-full border transition-all", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-transparent")}>
                  <Check className="size-2.5" strokeWidth={3} />
                </span>

                <div className="min-w-0">
                    <p className="truncate pr-4 text-[9px] font-semibold uppercase text-muted-foreground">
                    {duration ?? planTypeLabel(p.name)}
                  </p>
                  <p
                    className={cn(
                        "mt-1.5 truncate text-base font-bold leading-none tabular-nums sm:text-lg",
                      "transition-colors duration-300",
                      selected ? "text-primary" : "text-foreground",
                    )}
                  >
                    {title}
                  </p>
                  {!size ? (
                      <p className="mt-1.5 line-clamp-2 text-[9px] font-normal leading-snug text-muted-foreground">
                      {p.name}
                    </p>
                  ) : (
                    <p className="mt-1.5 flex items-center gap-1 truncate text-[9px] font-medium text-muted-foreground">
                      <Sparkles className="size-2.5 shrink-0 text-primary/60" /> {planTypeLabel(p.name)}
                    </p>
                  )}
                </div>

                <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold leading-none tabular-nums text-foreground sm:text-sm">
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
              </Button>
              </motion.div>
            );
          })
          }</AnimatePresence>
        )}
      </motion.div>

      <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[10px] text-muted-foreground/70">
        <Signal className="size-3" /> Live plans and prices from {displayNetwork}
      </p>
    </div>
  );
}
