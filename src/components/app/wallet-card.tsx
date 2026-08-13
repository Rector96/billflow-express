import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Plus } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { formatNaira } from "@/lib/mock-data";

export function WalletCard({ label = "Wallet Balance" }: { label?: string }) {
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

      <Link
        to="/wallet/fund"
        search={{}}
        className="press mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-primary"
      >
        <Plus className="size-4" /> Fund Wallet
      </Link>
    </section>
  );
}
