import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PayStepMeta = { key: string; label: string };

function safeStepIndex(value: unknown, length: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || length <= 0) return 0;
  return Math.min(Math.max(Math.floor(n), 0), length - 1);
}

/**
 * Horizontal numbered progress rail.
 * Accepts `current` (0-based) or legacy `currentIndex` so callers never hit "Step NaN of N".
 */
export function PayStepper({
  steps,
  current,
  currentIndex,
  className,
}: {
  steps: PayStepMeta[];
  /** 0-based active step */
  current?: number;
  /** Alias used by some flows — same as current */
  currentIndex?: number;
  className?: string;
}) {
  if (steps.length === 0) return null;

  const raw = current ?? currentIndex ?? 0;
  const idx = safeStepIndex(raw, steps.length);
  const active = steps[idx];

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1">
        {steps.map((s, i) => {
          const done = i < idx;
          const isNow = i === idx;
          return (
            <div
              key={s.key}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-200",
                done || isNow ? "bg-primary" : "bg-muted",
              )}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
        <span>
          Step {idx + 1} of {steps.length}
        </span>
        <span className="font-semibold text-foreground">{active?.label}</span>
      </div>
    </div>
  );
}

/**
 * Vertically balanced step page: header, content, optional footer dock.
 */
export function PayStepBody({
  eyebrow,
  title,
  description,
  stepper,
  children,
  footer,
  center,
  className,
}: {
  eyebrow?: ReactNode;
  title?: string;
  description?: string;
  stepper?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-[calc(100dvh-10.5rem)] w-full max-w-md flex-col px-4 pt-5 pb-4 sm:pt-6 lg:min-h-[calc(100dvh-7rem)]",
        className,
      )}
    >
      {stepper ? <div className="mb-5">{stepper}</div> : null}

      {title || description || eyebrow ? (
        <div className="mb-4 space-y-1">
          {eyebrow}
          {title ? <h2 className="text-xl font-extrabold tracking-tight">{title}</h2> : null}
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn("flex flex-1 flex-col", center && "items-center justify-center text-center")}
      >
        {children}
      </div>

      {footer ? <div className="mt-auto pt-4">{footer}</div> : null}
    </div>
  );
}
