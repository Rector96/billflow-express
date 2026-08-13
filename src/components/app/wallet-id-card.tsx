import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";

export function WalletIdCard() {
  const { profile } = useApp();
  const id = profile.billpayId || "————————";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      toast.success(`${BRAND.name} ID copied`);
    } catch {
      toast.error("Couldn't copy — long-press the ID instead");
    }
  };

  const share = async () => {
    const text = `My ${BRAND.name} ID is ${id}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `My ${BRAND.name} ID`, text });
        return;
      } catch {
        /* dismissed */
      }
    }
    toast.info(text);
  };

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">My {BRAND.name} ID</p>
          <p className="truncate text-xl font-extrabold tracking-[0.18em] tabular-nums">{id}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={copy}
            className="press flex h-10 items-center gap-1.5 rounded-xl bg-primary-soft px-3 text-xs font-bold text-primary"
          >
            <Copy className="size-4" /> Copy ID
          </button>
          <button
            type="button"
            onClick={share}
            aria-label={`Share ${BRAND.name} ID`}
            className="press grid size-10 place-items-center rounded-xl border text-muted-foreground"
          >
            <Share2 className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {`Your unique ${BRAND.name} ID. Wallet-to-wallet transfers are not enabled yet.`}
      </p>
    </section>
  );
}
