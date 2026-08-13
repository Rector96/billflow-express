import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

export function PinPad({
  value,
  onChange,
  length = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
}) {
  const press = (d: string) => {
    if (value.length >= length) return;
    onChange(value + d);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-center gap-4" role="status" aria-label={`${value.length} of ${length} digits entered`}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-4 rounded-full border-2 transition-colors",
              i < value.length ? "border-primary bg-primary" : "border-border bg-transparent",
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
          className="press grid h-14 place-items-center rounded-2xl text-muted-foreground"
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
      className="press h-14 rounded-2xl border bg-card text-xl font-bold shadow-card"
    >
      {label}
    </button>
  );
}
