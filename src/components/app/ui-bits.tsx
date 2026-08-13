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
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {action ? (
        to ? (
          <Link to={to} className="text-xs font-bold text-primary">
            {action}
          </Link>
        ) : (
          <button type="button" onClick={onAction} className="text-xs font-bold text-primary">
            {action}
          </button>
        )
      ) : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: TxStatus }) {
  const map = {
    successful: { label: "Successful", cls: "bg-success-soft text-success", Icon: CheckCircle2 },
    pending: { label: "Pending", cls: "bg-warning-soft text-warning-foreground", Icon: Clock3 },
    failed: { label: "Failed", cls: "bg-destructive-soft text-destructive", Icon: XCircle },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        map.cls,
      )}
    >
      <map.Icon className="size-3" />
      {map.label}
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
}: {
  label: string;
  Icon: LucideIcon;
  tint: string;
  to?: string;
  params?: Record<string, string>;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className={cn("grid size-11 place-items-center rounded-2xl", tint)}>
        <Icon className="size-5" />
      </span>
      <span className="text-center text-xs leading-tight font-semibold">{label}</span>
    </>
  );
  const cls =
    "press flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 shadow-card hover:border-primary/30";
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

export function TransactionRow({ tx }: { tx: Transaction }) {
  const inbound = tx.direction === "in";
  return (
    <Link
      to="/history/$txId"
      params={{ txId: tx.id }}
      className="press flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card"
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          inbound ? "bg-success-soft text-success" : "bg-primary-soft text-primary",
        )}
      >
        {inbound ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{tx.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {tx.service} • {tx.date}, {tx.time}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-bold", inbound ? "text-success" : "text-foreground")}>
          {inbound ? "+" : "-"}
          {formatNaira(tx.amount, false)}
        </p>
        <StatusBadge status={tx.status} />
      </div>
    </Link>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
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
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card/60 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <p className="text-sm font-bold">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
      <div className="size-10 shrink-0 animate-pulse rounded-xl bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
