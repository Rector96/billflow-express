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
      <div className="h-24 shrink-0 lg:h-20" aria-hidden />
      <div
        id={id}
        className={cn(
          "pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3",
          /* Mobile: sit above bottom nav */
          "bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
          /* Desktop: no bottom nav — dock near page bottom */
          "lg:bottom-6 lg:px-6",
          className,
        )}
      >
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border/70 bg-card/95 p-2.5 shadow-float backdrop-blur-xl lg:max-w-2xl lg:p-3">
          {children}
        </div>
      </div>
    </>
  );
}
