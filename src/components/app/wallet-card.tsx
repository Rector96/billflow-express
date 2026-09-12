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
    <section className="wallet-surface relative overflow-hidden rounded-2xl border border-primary-foreground/10 p-5 text-primary-foreground shadow-float">
      <span className="wallet-glow pointer-events-none absolute -right-10 -top-14 size-40 rounded-full blur-2xl" />
      <span className="wallet-glow pointer-events-none absolute -bottom-16 -left-12 size-32 rounded-full blur-2xl" />
      <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:18px_18px]" />
      <div className="relative">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-2 rounded-full bg-emerald-500" />
          <p className="text-xs font-medium uppercase text-primary-foreground/70">
            {label}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleBalance}
          aria-label={hideBalance ? "Show balance" : "Hide balance"}
          className="press grid size-8 place-items-center rounded-full bg-primary-foreground/12 text-primary-foreground transition-colors hover:bg-primary-foreground/20"
        >
          {hideBalance ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-3xl font-bold tabular-nums text-primary-foreground">
            {hideBalance ? "₦ • • • • • •" : formatNaira(balance)}
          </p>
        </div>
        <Link
          to="/wallet/fund"
          search={{}}
          className="press flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-foreground text-primary shadow-sm hover:bg-primary-foreground/90"
          aria-label="Add funds"
        >
          <Plus className="size-5 stroke-[2.2]" />
        </Link>
      </div>

      <div className="mt-5 flex items-center gap-2.5 border-t border-primary-foreground/15 pt-3.5">
        <Link
          to="/wallet/fund"
          search={{}}
          className="press flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary-foreground text-xs font-semibold text-primary shadow-sm hover:bg-primary-foreground/90"
        >
          <Plus className="size-3.5 stroke-[2.2]" /> Top Up
        </Link>
        <Link
          to="/services"
          className="press flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary-foreground/12 text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/20"
        >
          Pay a Bill
        </Link>
        <Link
          to="/history"
          className="press inline-flex h-9 items-center justify-center rounded-xl border border-primary-foreground/15 bg-primary-foreground/8 px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/15"
        >
          History
        </Link>
      </div>
      </div>
    </section>
  );
}
