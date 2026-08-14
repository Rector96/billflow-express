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
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-extrabold tracking-tight text-foreground">{title}</h2>
      {action ? (
        to ? (
          <Link to={to} className="text-xs font-semibold text-primary">
            {action}
          </Link>
        ) : (
          <button type="button" onClick={onAction} className="text-xs font-semibold text-primary">
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
      cls: "bg-success-soft text-success",
      Icon: CheckCircle2,
    },
    pending: {
      label: "Pending",
      short: "Pending",
      cls: "bg-warning-soft text-warning-foreground",
      Icon: Clock3,
    },
    failed: {
      label: "Failed",
      short: "Failed",
      cls: "bg-destructive-soft text-destructive",
      Icon: XCircle,
    },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]",
        map.cls,
      )}
    >
      {!compact ? <map.Icon className="size-3" strokeWidth={2.5} /> : null}
      {map.short}
    </span>
  );
}

/** Circular icon tiles — matches product mock Pay Bills grid */
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
      <span className={cn("grid size-12 place-items-center rounded-2xl", tint)}>
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <span className="text-center text-[11px] leading-tight font-semibold text-foreground">
        {label}
      </span>
    </>
  );
  const cls = cn(
    "press flex flex-col items-center justify-center gap-2 rounded-2xl bg-transparent p-1",
    compact ? "min-h-[4.5rem]" : "min-h-[5rem]",
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
        "press flex items-center gap-3 rounded-2xl bg-card",
        compact ? "px-3 py-2.5 shadow-soft" : "border border-border/50 p-3.5 shadow-card",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full",
          inbound ? "bg-success-soft text-success" : "bg-primary-soft text-primary",
        )}
      >
        {inbound ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{tx.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {tx.service} · {tx.date}{compact ? "" : `, ${tx.time}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-sm font-extrabold tabular-nums",
            inbound ? "text-success" : "text-foreground",
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
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
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
