import { Link } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Home / standalone Care entry — no tickets created in Phase 1. */
export function CareEntryCard({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/80 bg-card p-4 shadow-card",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <HeartHandshake className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold tracking-tight">RockPay Care</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Need help with a payment, wallet or account? We're here to help.
          </p>
          <Button asChild className="mt-3 h-10 rounded-xl font-bold" size="sm">
            <Link to="/support">Get Help</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Contextual Care link for transaction screens — passes reference only. */
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
      ? { title: "Something went wrong?", cta: "Get help from RockPay Care" }
      : status === "pending"
        ? { title: "Need help?", cta: "Contact RockPay Care" }
        : { title: "Need help with this transaction?", cta: "Get help" };

  return (
    <div className={cn("rounded-2xl border border-border/80 bg-card p-4 text-center shadow-card", className)}>
      <p className="text-sm font-bold">{copy.title}</p>
      <Button asChild variant="outline" className="mt-3 h-11 w-full rounded-2xl font-bold">
        <Link
          to="/support"
          search={reference ? { reference } : {}}
        >
          {copy.cta}
        </Link>
      </Button>
    </div>
  );
}
