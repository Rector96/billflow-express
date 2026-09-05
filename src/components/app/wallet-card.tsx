import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Plus } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { formatNaira } from "@/lib/mock-data";

/**
 * Balance card matches product mock: white surface, purple Fund CTA.
 * Placed over the deep purple home header.
 */
export function WalletCard({ label = "Wallet Balance" }: { label?: string }) {
  const { balance, hideBalance, toggleBalance } = useApp();

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 text-card-foreground shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-2 rounded-full bg-emerald-500" />
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleBalance}
          aria-label={hideBalance ? "Show balance" : "Hide balance"}
          className="press grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
        >
          {hideBalance ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
            {hideBalance ? "₦ • • • • • •" : formatNaira(balance)}
          </p>
        </div>
        <Link
          to="/wallet/fund"
          search={{}}
          className="press flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary-deep"
          aria-label="Add funds"
        >
          <Plus className="size-5 stroke-[2.2]" />
        </Link>
      </div>

      <div className="mt-5 flex items-center gap-2.5 border-t border-border/50 pt-3.5">
        <Link
          to="/wallet/fund"
          search={{}}
          className="press flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-deep"
        >
          <Plus className="size-3.5 stroke-[2.2]" /> Top Up
        </Link>
        <Link
          to="/services"
          className="press flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-secondary text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
        >
          Pay a Bill
        </Link>
        <Link
          to="/history"
          className="press inline-flex h-9 items-center justify-center px-3.5 rounded-xl border border-border/80 bg-card text-xs font-semibold text-foreground hover:bg-secondary"
        >
          History
        </Link>
      </div>
    </section>
  );
}
