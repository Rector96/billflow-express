import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PayStepMeta = { key: string; label: string };

/**
 * Horizontal numbered progress rail — mirrors the "1 Select Provider → 5 Confirm & Pay"
 * pattern from the product design reference.
 */
export function PayStepper({
  steps,
  current,
  className,
}: {
  steps: PayStepMeta[];
  current: number;
  className?: string;
}) {
  if (steps.length === 0) return null;
  const active = steps[Math.min(Math.max(current, 0), steps.length - 1)];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => {
          const done = i < current;
          const isNow = i === current;
          return (
            <div key={s.key} className="flex min-w-0 flex-1 items-center gap-1.5">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold transition-colors",
                  done
                    ? "bg-primary text-primary-foreground"
                    : isNow
                      ? "bg-primary text-primary-foreground ring-4 ring-primary-soft"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              {i < steps.length - 1 ? (
                <span
                  className={cn(
                    "h-1 min-w-0 flex-1 rounded-full transition-colors",
                    done ? "bg-primary" : "bg-muted",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-xs font-bold tracking-wide text-primary uppercase">
        Step {Math.min(current + 1, steps.length)} of {steps.length} · {active?.label}
      </p>
    </div>
  );
}

/**
 * Vertically balanced step page: header block, breathing content area and a CTA
 * docked to the bottom of the viewport instead of everything clinging to the top.
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

      <div className={cn("flex-1 space-y-3", center && "flex flex-col justify-center")}>
        {children}
      </div>

      {footer ? (
        <div className="sticky bottom-0 -mx-4 mt-6 space-y-2 bg-gradient-to-t from-background via-background to-transparent px-4 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
