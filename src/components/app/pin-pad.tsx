import { useEffect, useRef } from "react";
import { Delete } from "lucide-react";
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
    <div className="mx-auto w-full max-w-xs space-y-8">
      <div
        className="flex justify-center gap-4"
        role="status"
        aria-label={`${value.length} of ${length} digits entered`}
      >
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full border-2 transition-all duration-150",
              i < value.length
                ? "border-primary bg-primary scale-110"
                : "border-muted-foreground/30 bg-muted/20",
            )}
          />
        ))}
      </div>

      <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} label={d} onClick={() => press(d)} />
        ))}
        <span />
        <Key label="0" onClick={() => press("0")} />
        <button
          type="button"
          aria-label="Delete last digit"
          onClick={() => onChange(value.slice(0, -1))}
          className="press grid h-14 place-items-center rounded-2xl text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
        >
          <Delete className="size-6" />
        </button>
      </div>
    </div>
  );
}

function Key({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press h-14 rounded-2xl border bg-card text-xl font-bold shadow-card active:scale-95 transition-transform"
    >
      {label}
    </button>
  );
}
