import { useEffect, useRef } from "react";
import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PinPad({
  value,
  onChange,
  length = 4,
  onFilled,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  /** Called once when the PIN reaches `length` digits */
  onFilled?: (pin: string) => void;
}) {
  const filledRef = useRef(false);

  useEffect(() => {
    if (value.length >= length) {
      if (!filledRef.current) {
        filledRef.current = true;
        onFilled?.(value.slice(0, length));
      }
    } else {
      filledRef.current = false;
    }
  }, [value, length, onFilled]);

  const press = (d: string) => {
    if (value.length >= length) return;
    onChange(value + d);
  };

  return (
    <div className="mx-auto w-full max-w-[17rem] space-y-5">
      <div
        className="flex justify-center gap-3"
        role="status"
        aria-label={`${value.length} of ${length} digits entered`}
      >
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full border-2 transition-all duration-200",
              i < value.length
                ? "scale-110 border-primary bg-primary shadow-[0_0_0_4px_var(--color-primary-soft)]"
                : "border-border bg-muted/60",
            )}
          />
        ))}
      </div>

      <div className="mx-auto grid grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} label={d} onClick={() => press(d)} />
        ))}
        <span />
        <Key label="0" onClick={() => press("0")} />
        <Button
          type="button"
          variant="ghost"
          aria-label="Delete last digit"
          onClick={() => onChange(value.slice(0, -1))}
          className="press h-12 rounded-xl text-muted-foreground"
        >
          <Delete className="size-5" />
        </Button>
      </div>
    </div>
  );
}

function Key({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="press h-12 rounded-xl border-border/70 bg-card text-lg font-bold shadow-soft hover:border-primary/30 hover:bg-primary-soft"
    >
      {label}
    </Button>
  );
}
