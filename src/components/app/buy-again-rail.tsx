import { useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/app/ui-bits";
import { formatNaira, getService } from "@/lib/mock-data";
import type { BuyAgainItem } from "@/lib/buy-again";
import { cn } from "@/lib/utils";

export function BuyAgainRail({
  items,
  empty,
}: {
  items: BuyAgainItem[];
  empty?: boolean;
}) {
  const navigate = useNavigate();

  if (empty || items.length === 0) {
    return (
      <section>
        <SectionTitle title="Buy Again" />
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/70 px-4 py-6 text-center">
          <p className="text-sm font-bold">Your quick payments will appear here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Make your first payment and we'll make the next one faster.
          </p>
          <Button
            className="mt-4 h-11 rounded-2xl font-bold"
            onClick={() => navigate({ to: "/services" })}
          >
            Make a Payment
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle title="Buy Again" />
      <div className="space-y-2.5">
        {items.map((item) => {
          const svc = getService(item.serviceSlug);
          return (
            <div
              key={item.key}
              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-card"
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl",
                  svc?.tint ?? "bg-muted text-muted-foreground",
                )}
              >
                {svc ? <svc.icon className="size-5" /> : <RotateCcw className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{item.label}</p>
                <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {formatNaira(item.amount, false)}
                </p>
              </div>
              <Button
                size="sm"
                className="h-9 shrink-0 rounded-xl px-4 font-bold"
                onClick={() => {
                  // Prefill only — never auto-charge. PIN + confirm still required in pay flow.
                  void navigate({
                    to: "/pay/$slug",
                    params: { slug: String(item.serviceSlug) },
                    search: {
                      ...(item.savedId ? { saved: item.savedId } : {}),
                      ...(item.provider ? { provider: item.provider } : {}),
                      ...(item.amount ? { amount: item.amount } : {}),
                      ...(item.identifier && !item.savedId
                        ? { identifier: item.identifier }
                        : {}),
                    },
                  });
                }}
              >
                Buy Again
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
