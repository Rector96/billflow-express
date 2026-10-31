import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Boxes, Percent, ShieldCheck, Settings2 } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: `Settings — ${BRAND.name} Admin` }] }),
  component: AdminSettings,
});

const destinations = [
  {
    to: "/admin/pricing" as const,
    title: "Pricing and service fees",
    description: "Manage VTpass bill markups and the RockPay hub catalogue fees used by customer checkout.",
    icon: Percent,
  },
  {
    to: "/admin/services" as const,
    title: "Service availability",
    description: "See which services are live, manually fulfilled, preview-only or removed. Control live electricity and cable availability.",
    icon: Boxes,
  },
  {
    to: "/admin/staff" as const,
    title: "Staff access",
    description: "Review staff roles. Role grants remain restricted to the secured database administration process.",
    icon: ShieldCheck,
  },
] as const;

function AdminSettings() {
  return (
    <AdminShell title="Settings" subtitle="Configuration shortcuts and platform controls">
      <div className="mb-4 rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2">
          <Settings2 className="size-5 text-primary" />
          <h2 className="text-sm font-extrabold">RockPay operations configuration</h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Configuration is split by responsibility so changes are applied through the correct,
          audited workflow. Payment-provider credentials and private API keys are never editable
          or displayed in this admin page; manage them in the secured hosting environment.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {destinations.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group rounded-2xl border bg-card p-4 shadow-card transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="size-5" />
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
            <p className="mt-3 text-sm font-extrabold">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
          </Link>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
        <p className="text-xs font-bold">Security note</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Wallet balances, payment verification, CAC fulfilment and provider credentials are not
          changed from a generic settings form. Their dedicated server-side workflows preserve
          payment checks, staff permissions and audit history.
        </p>
      </div>
    </AdminShell>
  );
}
