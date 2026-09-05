import { Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatNaira, type Transaction, type TxStatus } from "@/lib/mock-data";

export function SectionTitle({
  title,
  action,
  to,
  onAction,
}: {
  title: string;
  action?: string;
  to?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      {action ? (
        to ? (
          <Link
            to={to}
            className="text-xs font-medium text-primary hover:text-primary-deep transition-colors"
          >
            {action}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="text-xs font-medium text-primary hover:text-primary-deep transition-colors"
          >
            {action}
          </button>
        )
      ) : null}
    </div>
  );
}

export function StatusBadge({ status, compact }: { status: TxStatus; compact?: boolean }) {
  const map = {
    successful: {
      label: "Successful",
      short: "Successful",
      cls: "bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
      Icon: CheckCircle2,
    },
    pending: {
      label: "Pending",
      short: "Pending",
      cls: "bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
      Icon: Clock3,
    },
    failed: {
      label: "Failed",
      short: "Failed",
      cls: "bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40",
      Icon: XCircle,
    },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        map.cls,
      )}
    >
      {!compact ? <map.Icon className="size-3" strokeWidth={2} /> : null}
      {map.short}
    </span>
  );
}

/** Modern clean squircle chips */
export function ServiceTile({
  label,
  Icon,
  tint,
  to,
  params,
  onClick,
  compact,
}: {
  label: string;
  Icon: LucideIcon;
  tint: string;
  to?: string;
  params?: Record<string, string>;
  onClick?: () => void;
  compact?: boolean;
}) {
  const inner = (
    <>
      <span
        className={cn(
          "grid place-items-center rounded-2xl transition-all duration-150 group-hover:scale-105 group-active:scale-95 shadow-sm",
          compact ? "size-11" : "size-12",
          tint,
        )}
      >
        <Icon className={compact ? "size-5" : "size-5"} strokeWidth={1.8} />
      </span>
      <span className="text-center text-[12px] leading-tight font-medium text-foreground">
        {label}
      </span>
    </>
  );
  const cls = cn(
    "group press flex flex-col items-center justify-center gap-1.5 rounded-xl p-2 transition-all hover:bg-card/70",
    compact ? "min-h-[4.25rem]" : "min-h-[4.75rem]",
  );
  if (to) {
    return (
      <Link to={to} {...(params ? { params } : {})} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export function TransactionRow({ tx, compact }: { tx: Transaction; compact?: boolean }) {
  const inbound = tx.direction === "in";
  return (
    <Link
      to="/history/$txId"
      params={{ txId: tx.id }}
      className={cn(
        "press flex items-center gap-3 rounded-xl border border-border/70 bg-card transition-colors hover:border-border",
        compact ? "px-3 py-2.5 shadow-soft" : "px-3.5 py-3 shadow-soft",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          inbound
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50"
            : "bg-primary-soft text-primary",
        )}
      >
        {inbound ? (
          <ArrowDownLeft className="size-4" strokeWidth={2} />
        ) : (
          <ArrowUpRight className="size-4" strokeWidth={2} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{tx.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {tx.service} · {tx.date}
          {compact ? "" : `, ${tx.time}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            inbound ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
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

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-2.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold">{value}</span>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  Icon,
}: {
  title: string;
  body: string;
  Icon: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 bg-card px-5 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-extrabold">{title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
      <div className="skeleton size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-2.5 w-3/4" />
      </div>
      <div className="skeleton h-6 w-14" />
    </div>
  );
}
