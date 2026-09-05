import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { HOME_PROMOS } from "@/lib/marketing";
import { cn } from "@/lib/utils";

/** Elegant promo cards on Home — edit content in src/lib/marketing.ts */
export function HomePromos({ className }: { className?: string }) {
  const items = HOME_PROMOS.filter((p) => p.enabled);
  if (!items.length) return null;

  return (
    <div className={cn("space-y-2.5", className)}>
      {items.map((promo) => (
        <div
          key={promo.id}
          className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft"
        >
          {promo.image ? (
            <div className="absolute inset-0 opacity-[0.14]">
              <img src={promo.image} alt="" className="size-full object-cover" loading="lazy" />
            </div>
          ) : null}
          <div className="relative flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold tracking-tight">{promo.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{promo.body}</p>
            </div>
            {promo.ctaTo && promo.ctaLabel ? (
              <Link
                to={promo.ctaTo}
                className="press inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
              >
                {promo.ctaLabel}
                <ChevronRight className="size-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
