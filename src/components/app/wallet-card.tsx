import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Plus } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { formatNaira } from "@/lib/mock-data";

export function WalletCard({ label = "Wallet Balance" }: { label?: string }) {
  const { balance, hideBalance, toggleBalance } = useApp();

  return (
    <section className="brand-gradient relative overflow-hidden rounded-2xl px-4 py-3.5 text-primary-foreground shadow-float">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-8 size-28 rounded-full bg-white/10 blur-2xl"
      />

      <div className="relative flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide uppercase opacity-90">{label}</p>
        <button
          type="button"
          onClick={toggleBalance}
          aria-label={hideBalance ? "Show balance" : "Hide balance"}
          className="press grid size-8 place-items-center rounded-lg bg-white/15 ring-1 ring-white/20"
        >
          {hideBalance ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>

      <p className="relative mt-1.5 text-[1.65rem] leading-none font-extrabold tracking-tight tabular-nums">
        {hideBalance ? "₦ • • • • • •" : formatNaira(balance)}
      </p>

      <Link
        to="/wallet/fund"
        search={{}}
        className="press relative mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-bold text-primary"
      >
        <Plus className="size-3.5" /> Fund Wallet
      </Link>
    </section>
  );
}
