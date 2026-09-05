import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Fixed primary action above mobile bottom nav so Continue is always visible
 * without relying on sticky (broken in many mobile browsers inside AppShell).
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
    <>
      <div className="h-20 shrink-0 lg:h-4" aria-hidden />
      <div
        id={id}
        className={cn(
          "fixed inset-x-0 z-40 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-md",
          "bottom-[calc(4.25rem+env(safe-area-inset-bottom))] lg:bottom-6",
          "mx-auto w-full max-w-2xl lg:max-w-md lg:rounded-2xl lg:border lg:shadow-float",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
