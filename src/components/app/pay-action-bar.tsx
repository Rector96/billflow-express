import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Keeps the primary Continue / Pay button visible above the mobile bottom nav.
 * Place at the end of each pay-flow step.
 */
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
    <div
      id={id}
      className={cn(
        "sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 -mx-4 mt-6 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md lg:bottom-4 lg:mx-0 lg:rounded-2xl lg:border",
        className,
      )}
    >
      {children}
    </div>
  );
}
