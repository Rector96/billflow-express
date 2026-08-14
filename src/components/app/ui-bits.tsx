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
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-sm font-extrabold tracking-tight">{title}</h2>
      {action ? (
        to ? (
          <Link to={to} className="text-[11px] font-bold text-primary hover:underline">
            {action}
          </Link>
        ) : (
          <button type="button" onClick={onAction} className="text-[11px] font-bold text-primary hover:underline">
            {action}
          </button>
        )
      ) : null}
    </div>
  );
}

export function StatusBadge({ status, compact }: { status: TxStatus; compact?: boolean }) {
  const map = {
    successful: { label: compact ? "OK" : "Successful", short: "✓", cls: "bg-success-soft text-success", Icon: CheckCircle2 },
    pending: { label: compact ? "Wait" : "Pending", short: "◷", cls: "bg-warning-soft text-warning-foreground", Icon: Clock3 },
    failed: { label: compact ? "Fail" : "Failed", short: "✗", cls: "bg-destructive-soft text-destructive", Icon: XCircle },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full font-bold tracking-wide",
        compact ? "px-1.5 py-0 text-[10px]" : "gap-1 px-2.5 py-0.5 text-[11px]",
        map.cls,
      )}
    >
      {!compact ? <map.Icon className="size-3" strokeWidth={2.5} /> : null}
      {compact ? map.short : map.label}
    </span>
  );
}

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
          "grid place-items-center",
          compact ? "size-9 rounded-xl" : "size-11 rounded-2xl shadow-soft",
          tint,
        )}
      >
        <Icon className={compact ? "size-4" : "size-5"} />
      </span>
      <span className={cn("text-center leading-tight font-semibold", compact ? "text-[10px]" : "text-xs")}>
        {label}
      </span>
    </>
  );
  const cls = cn(
    "press flex flex-col items-center justify-center border border-border/70 bg-card hover:border-primary/25",
    compact
      ? "min-h-[4.25rem] gap-1 rounded-xl p-1.5"
      : "min-h-[5.5rem] gap-2 rounded-2xl p-3 shadow-card hover:shadow-soft",
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
        "press flex items-center border border-border/70 bg-card hover:border-primary/20",
        compact ? "gap-2 rounded-xl px-2.5 py-2" : "gap-3 rounded-2xl p-3.5 shadow-card",
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center",
          compact ? "size-8 rounded-lg" : "size-11 rounded-2xl",
          inbound ? "bg-success-soft text-success" : "bg-primary-soft text-primary",
        )}
      >
        {inbound ? (
          <ArrowDownLeft className={compact ? "size-3.5" : "size-5"} />
        ) : (
          <ArrowUpRight className={compact ? "size-3.5" : "size-5"} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-bold", compact ? "text-xs" : "text-sm")}>{tx.title}</p>
        <p className={cn("truncate text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>
          {compact ? `${tx.date} · ${tx.time}` : `${tx.service} • ${tx.date}, ${tx.time}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "font-extrabold tabular-nums",
            compact ? "text-xs" : "text-sm",
            inbound ? "text-success" : "text-foreground",
          )}
        >
          {inbound ? "+" : "-"}
          {formatNaira(tx.amount, false)}
        </p>
        <div className="mt-0.5 flex justify-end">
          <StatusBadge status={tx.status} compact={compact} />
        </div>
      </div>
    </Link>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-0">
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
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/80 bg-card/70 px-5 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-extrabold">{title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card p-2.5">
      <div className="skeleton size-8 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton h-2.5 w-1/2" />
        <div className="skeleton h-2.5 w-3/4" />
      </div>
      <div className="skeleton h-6 w-14" />
    </div>
  );
}
