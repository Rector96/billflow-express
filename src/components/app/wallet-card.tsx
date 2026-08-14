import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Plus } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { formatNaira } from "@/lib/mock-data";

export function WalletCard({ label = "Wallet Balance" }: { label?: string }) {
  const { balance, hideBalance, toggleBalance } = useApp();

  return (
    <section className="brand-gradient relative overflow-hidden rounded-3xl p-5 text-primary-foreground shadow-float">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-10 size-40 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-8 size-36 rounded-full bg-black/10 blur-2xl"
      />

      <div className="relative flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide uppercase opacity-90">{label}</p>
        <button
          type="button"
          onClick={toggleBalance}
          aria-label={hideBalance ? "Show balance" : "Hide balance"}
          className="press grid size-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"
        >
          {hideBalance ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      <p className="relative mt-3 text-[2rem] leading-none font-extrabold tracking-tight tabular-nums sm:text-3xl">
        {hideBalance ? "₦ • • • • • •" : formatNaira(balance)}
      </p>
      <p className="relative mt-1.5 text-[11px] font-medium opacity-80">Available to spend</p>

      <Link
        to="/wallet/fund"
        search={{}}
        className="press relative mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-primary shadow-soft"
      >
        <Plus className="size-4" /> Fund Wallet
      </Link>
    </section>
  );
}
