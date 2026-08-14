import { useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNaira, getService } from "@/lib/mock-data";
import type { BuyAgainItem } from "@/lib/buy-again";
import { cn } from "@/lib/utils";

export function BuyAgainRail({
  items,
  empty,
  compact = false,
}: {
  items: BuyAgainItem[];
  empty?: boolean;
  compact?: boolean;
}) {
  const navigate = useNavigate();

  // No oversized empty card — parent handles absence of Quick Pay section
  if (empty || items.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", !compact && "space-y-2")}>
      {items.map((item) => {
        const svc = getService(item.serviceSlug);
        return (
          <div
            key={item.key}
            className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card px-2.5 py-2"
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg",
                svc?.tint ?? "bg-muted text-muted-foreground",
              )}
            >
              {svc ? <svc.icon className="size-3.5" /> : <RotateCcw className="size-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{item.label}</p>
              <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                {formatNaira(item.amount, false)}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 shrink-0 rounded-lg px-3 text-xs font-bold"
              onClick={() => {
                void navigate({
                  to: "/pay/$slug",
                  params: { slug: String(item.serviceSlug) },
                  search: {
                    ...(item.savedId ? { saved: item.savedId } : {}),
                    ...(item.provider ? { provider: item.provider } : {}),
                    ...(item.amount ? { amount: item.amount } : {}),
                    ...(item.identifier && !item.savedId ? { identifier: item.identifier } : {}),
                  },
                });
              }}
            >
              Buy
            </Button>
          </div>
        );
      })}
    </div>
  );
}
