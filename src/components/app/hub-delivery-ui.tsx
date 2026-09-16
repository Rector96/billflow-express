/**
 * Compact mobile UI: download vs deliver + address form.
 * Matches RockPay card / button language.
 */
import { Download, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type DeliveryAddress,
  type DeliveryMethod,
  NG_DELIVERY_STATES,
} from "@/lib/hub-delivery";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const field = "h-11 rounded-xl";

export function DeliveryMethodCards({
  method,
  onChange,
  downloadLabel,
  downloadSub,
  downloadPrice,
  deliverLabel,
  deliverSub,
  deliverPrice,
}: {
  method: DeliveryMethod | null;
  onChange: (m: DeliveryMethod) => void;
  downloadLabel: string;
  downloadSub: string;
  downloadPrice: number;
  deliverLabel: string;
  deliverSub: string;
  deliverPrice: number;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onChange("download")}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left",
          method === "download" ? "border-primary bg-primary/5" : "border-border/80 bg-card",
        )}
      >
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <Download className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{downloadLabel}</p>
          <p className="text-[11px] text-muted-foreground">{downloadSub}</p>
        </div>
        <p className="text-xs font-bold tabular-nums text-primary">{formatNaira(downloadPrice, false)}</p>
      </button>
      <button
        type="button"
        onClick={() => onChange("deliver")}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left",
          method === "deliver" ? "border-primary bg-primary/5" : "border-border/80 bg-card",
        )}
      >
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <Truck className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{deliverLabel}</p>
          <p className="text-[11px] text-muted-foreground">{deliverSub}</p>
        </div>
        <p className="text-xs font-bold tabular-nums text-primary">{formatNaira(deliverPrice, false)}</p>
      </button>
    </div>
  );
}

export function DeliveryAddressFields({
  value,
  onChange,
}: {
  value: DeliveryAddress;
  onChange: (next: DeliveryAddress) => void;
}) {
  const set = (patch: Partial<DeliveryAddress>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-2.5 rounded-2xl border border-border/80 bg-card p-3.5 shadow-soft">
      <p className="text-sm font-semibold">Delivery address</p>
      <div className="space-y-1">
        <Label>Phone</Label>
        <Input
          value={value.phone}
          onChange={(e) => set({ phone: e.target.value })}
          inputMode="tel"
          className={field}
          placeholder="080…"
        />
      </div>
      <div className="space-y-1">
        <Label>Street</Label>
        <Input
          value={value.street}
          onChange={(e) => set({ street: e.target.value })}
          className={field}
          placeholder="House no, street"
        />
      </div>
      <div className="space-y-1">
        <Label>Area / landmark</Label>
        <Input value={value.area} onChange={(e) => set({ area: e.target.value })} className={field} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>LGA</Label>
          <Input value={value.lga} onChange={(e) => set({ lga: e.target.value })} className={field} />
        </div>
        <div className="space-y-1">
          <Label>State</Label>
          <select
            value={value.state}
            onChange={(e) => set({ state: e.target.value })}
            className={`w-full border border-input bg-background px-3 text-sm ${field}`}
          >
            {NG_DELIVERY_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export function PayBreakdown({
  lines,
  total,
}: {
  lines: { label: string; amount: number }[];
  total: number;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-3.5 text-sm shadow-soft">
      {lines.map((l) => (
        <div key={l.label} className="flex justify-between gap-2 py-1.5">
          <span className="text-muted-foreground">{l.label}</span>
          <span className="font-semibold tabular-nums">{formatNaira(l.amount, false)}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-border/60 pt-2.5 text-base font-bold">
        <span>Total</span>
        <span className="tabular-nums text-primary">{formatNaira(total, false)}</span>
      </div>
    </div>
  );
}
