import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: `Settings — ${BRAND.name} Admin` }] }),
  component: AdminSettings,
});

function AdminSettings() {
  return (
    <AdminShell title="Settings" subtitle="Operational configuration">
      <div className="space-y-4 text-sm">
        <div className="rounded-2xl border border-primary/20 bg-primary-soft/40 p-4 shadow-card">
          <p className="font-bold">Pricing & markups</p>
          <p className="mt-1 text-muted-foreground">
            Live markup rules for data, cable, electricity, exams and more. Airtime stays face-value
            (customer pays what the phone receives).
          </p>
          <Button className="mt-3 h-10 rounded-xl font-bold" asChild>
            <Link to="/admin/pricing">Open pricing rules</Link>
          </Button>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">Paystack</p>
          <p className="mt-1 text-muted-foreground">
            Test mode is enforced in server code (<code>sk_test_</code> only). Secret keys are set
            on Netlify, never in the browser.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">Staff access</p>
          <p className="mt-1 text-muted-foreground">
            Roles live in <code>user_roles</code> (<code>super_admin</code>, <code>admin</code>,{" "}
            <code>support</code>). Assign via Supabase SQL.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">VTpass mode</p>
          <p className="mt-1 text-muted-foreground">
            Product branch forces sandbox until go-live. Set keys on Netlify only.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
