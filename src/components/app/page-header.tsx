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
  showBack = true,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  variant?: "light" | "brand";
  className?: string;
  showBack?: boolean;
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
      className={cn(backClass, "lg:invisible")}
    >
      <ChevronLeft className="size-5" strokeWidth={1.8} />
    </button>
  );

  return (
    <header
      className={cn(
        "service-flow-page-header sticky top-0 z-40 shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:px-0 lg:pt-3",
        brand
          ? "brand-gradient text-primary-foreground"
          : "border-b border-border/60 bg-background/90 backdrop-blur-md lg:border-0 lg:bg-transparent lg:backdrop-blur-none",
        className,
      )}
    >
      <div className={cn("grid items-center gap-3", showBack ? "grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]")}>
        {showBack && backTo ? (
          <Link to={backTo} aria-label="Go back" className={cn(backClass, "lg:hidden")}>
            <ChevronLeft className="size-5" strokeWidth={1.8} />
          </Link>
        ) : showBack ? (
          back
        ) : null}
        <div className="min-w-0 text-center lg:text-left">
          <h1 className="truncate text-[15px] font-extrabold tracking-tight sm:text-base lg:text-lg">
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
