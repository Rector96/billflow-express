import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Plus, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import { formatNaira } from "@/lib/mock-data";

export function WalletCard({
  label = "Wallet Balance",
  withWithdraw = false,
}: {
  label?: string;
  withWithdraw?: boolean;
}) {
  const { balance, hideBalance, toggleBalance } = useApp();

  return (
    <section className="brand-gradient rounded-3xl p-5 text-primary-foreground shadow-float">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium opacity-85">{label}</p>
        <button
          type="button"
          onClick={toggleBalance}
          aria-label={hideBalance ? "Show balance" : "Hide balance"}
          className="press grid size-8 place-items-center rounded-lg bg-white/15"
        >
          {hideBalance ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums">
        {hideBalance ? "₦ • • • • • •" : formatNaira(balance)}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link
          to="/wallet/fund"
          className="press flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-primary"
        >
          <Plus className="size-4" /> Fund Wallet
        </Link>
        {withWithdraw ? (
          <button
            type="button"
            onClick={() => toast.info("Withdrawals are coming soon")}
            className="press flex h-12 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 text-sm font-bold"
          >
            <ArrowUpRight className="size-4" /> Withdraw
          </button>
        ) : null}
      </div>
    </section>
  );
}
