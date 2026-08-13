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

  const back = (
    <button
      type="button"
      aria-label="Go back"
      onClick={() => (onBack ? onBack() : router.history.back())}
      className={cn(
        "press grid size-10 shrink-0 place-items-center rounded-xl border",
        brand ? "border-white/25 bg-white/10 text-primary-foreground" : "bg-card",
      )}
    >
      <ChevronLeft className="size-5" />
    </button>
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-30 px-4 pt-4 pb-3",
        brand ? "brand-gradient text-primary-foreground" : "bg-background/90 backdrop-blur",
        className,
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        {backTo ? (
          <Link
            to={backTo}
            aria-label="Go back"
            className={cn(
              "press grid size-10 shrink-0 place-items-center rounded-xl border",
              brand ? "border-white/25 bg-white/10 text-primary-foreground" : "bg-card",
            )}
          >
            <ChevronLeft className="size-5" />
          </Link>
        ) : (
          back
        )}
        <div className="min-w-0 text-center">
          <h1 className="truncate text-base font-bold">{title}</h1>
          {subtitle ? (
            <p className={cn("truncate text-xs", brand ? "opacity-80" : "text-muted-foreground")}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex size-10 items-center justify-end">{right}</div>
      </div>
    </header>
  );
}
