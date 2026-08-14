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
    <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-card px-4 py-4 text-card-foreground shadow-float">
      <div className="relative flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <button
          type="button"
          onClick={toggleBalance}
          aria-label={hideBalance ? "Show balance" : "Hide balance"}
          className="press grid size-8 place-items-center rounded-full bg-muted text-muted-foreground"
        >
          {hideBalance ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>

      <p className="relative mt-1 text-[1.75rem] leading-none font-extrabold tracking-tight tabular-nums text-foreground">
        {hideBalance ? "₦ • • • • • •" : formatNaira(balance)}
      </p>

      <Link
        to="/wallet/fund"
        search={{}}
        className="press relative mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-soft"
      >
        <Plus className="size-4" /> Fund Wallet
      </Link>
    </section>
  );
}
