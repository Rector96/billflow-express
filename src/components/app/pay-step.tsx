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
    <div
      className={cn(
        "service-flow-stepper sticky top-0 z-30 rounded-2xl border border-border/70 bg-card/95 px-3 py-2.5 shadow-soft backdrop-blur-md lg:px-4 lg:py-3",
        className,
      )}
    >
      <div className="service-flow-numbered-steps" aria-label={`Step ${idx + 1} of ${steps.length}: ${active?.label ?? ""}`}>
        {steps.map((s, i) => {
          const done = i < idx;
          const isNow = i === idx;
          return (
            <div key={s.key} className="service-flow-step-item" aria-current={isNow ? "step" : undefined}>
              <span className={cn("service-flow-step-number", done && "is-complete", isNow && "is-current")}>
                {done ? "✓" : i + 1}
              </span>
              <span className={cn("service-flow-step-label", isNow && "is-current-label")}>{s.label}</span>
              {i < steps.length - 1 ? <span className={cn("service-flow-step-connector", done && "is-complete")} aria-hidden /> : null}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>Step {idx + 1} of {steps.length}</span>
        <span className="rounded-lg bg-primary-soft px-2.5 py-1 font-bold text-primary">{active?.label}</span>
      </div>
    </div>
  );
}

/**
 * Vertically balanced step page: header, content, optional footer dock.
 * Mobile stays compact; desktop uses a wider, calmer reading width.
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
        "payment-flow-page mx-auto flex min-h-[calc(100dvh-10.5rem)] w-full max-w-md flex-col px-4 pt-4 pb-4 sm:pt-5",
        "lg:min-h-[calc(100dvh-7rem)] lg:max-w-2xl lg:px-0 lg:pt-2",
        className,
      )}
    >
      {stepper ? <div className="mb-4 lg:mb-5">{stepper}</div> : null}

      {title || description || eyebrow ? (
        <div className="mb-4 space-y-1.5 lg:mb-5">
          {eyebrow}
          {title ? (
            <h2 className="text-xl font-extrabold tracking-tight lg:text-2xl">{title}</h2>
          ) : null}
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground lg:text-[15px]">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn("flex flex-1 flex-col", center && "items-center justify-center text-center")}
      >
        {children}
      </div>

      {footer ? <div className="mt-auto pt-4 lg:pt-6">{footer}</div> : null}
    </div>
  );
}
