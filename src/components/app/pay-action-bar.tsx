import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Always-visible primary CTA above mobile bottom nav (fixed, not sticky). */
export function PayActionBar({
  children,
  className,
  id = "pay-action",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <>
      <div className="h-24 shrink-0" aria-hidden />
      <div
        id={id}
        className={cn(
          "pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3",
          "bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
          className,
        )}
      >
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border/80 bg-background/98 p-3 shadow-float backdrop-blur-md">
          {children}
        </div>
      </div>
    </>
  );
}
