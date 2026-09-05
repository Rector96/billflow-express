import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  right,
  backTo,
  onBack,
  variant = "light",
  className,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  variant?: "light" | "brand";
  className?: string;
}) {
  const router = useRouter();
  const brand = variant === "brand";

  const backClass = cn(
    "press grid size-10 shrink-0 place-items-center rounded-full border shadow-sm transition-colors",
    brand
      ? "border-white/25 bg-white/15 text-primary-foreground hover:bg-white/25"
      : "border-border/80 bg-card text-foreground hover:bg-secondary",
  );

  const back = (
    <button
      type="button"
      aria-label="Go back"
      onClick={() => (onBack ? onBack() : router.history.back())}
      className={backClass}
    >
      <ChevronLeft className="size-5" />
    </button>
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-30 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3",
        brand
          ? "brand-gradient text-primary-foreground"
          : "border-b border-border/60 bg-background/90 backdrop-blur-md",
        className,
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        {backTo ? (
          <Link to={backTo} aria-label="Go back" className={backClass}>
            <ChevronLeft className="size-5" />
          </Link>
        ) : (
          back
        )}
        <div className="min-w-0 text-center">
          <h1 className="truncate text-[15px] font-extrabold tracking-tight sm:text-base">
            {title}
          </h1>
          {subtitle ? (
            <p className={cn("truncate text-xs", brand ? "opacity-85" : "text-muted-foreground")}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex min-h-10 min-w-10 items-center justify-end">{right}</div>
      </div>
    </header>
  );
}
