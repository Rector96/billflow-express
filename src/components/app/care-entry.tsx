import { Link } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Compact Care entry — prefer the Home row; this remains for reuse. */
export function CareEntryCard({ className }: { className?: string }) {
  return (
    <Link
      to="/support"
      className={cn(
        "press flex items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3 py-2.5",
        className,
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <HeartHandshake className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold">RockPay Care</p>
        <p className="text-[10px] text-muted-foreground">Need help with a transaction?</p>
      </div>
      <span className="text-[11px] font-bold text-primary">Get help</span>
    </Link>
  );
}

export function CareContextLink({
  reference,
  status,
  className,
}: {
  reference?: string;
  status?: "successful" | "pending" | "failed";
  className?: string;
}) {
  const copy =
    status === "failed"
      ? { title: "Something went wrong?", cta: "RockPay Care" }
      : status === "pending"
        ? { title: "Need help?", cta: "RockPay Care" }
        : { title: "Need help with this?", cta: "Get help" };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5",
        className,
      )}
    >
      <p className="text-xs font-bold">{copy.title}</p>
      <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs font-bold">
        <Link to="/support" search={reference ? { reference } : {}}>
          {copy.cta}
        </Link>
      </Button>
    </div>
  );
}
