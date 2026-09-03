import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { BRAND } from "@/lib/brand";
import { can, requireStaffSession } from "@/lib/admin";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: `Settings — ${BRAND.name} Admin` }] }),
  beforeLoad: async () => {
    const staff = await requireStaffSession();
    if (!can(staff.perms, "settings")) {
      throw redirect({ to: "/admin" });
    }
  },
  component: AdminSettings,
});

function AdminSettings() {
  return (
    <AdminShell title="Settings" subtitle="Operational configuration notes">
      <div className="space-y-4 text-sm">
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">Paystack</p>
          <p className="mt-1 text-muted-foreground">
            Test mode is enforced in server code (<code>sk_test_</code> only). Secret keys are set on Netlify, never
            in the browser. Do not paste keys here.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">Staff access</p>
          <p className="mt-1 text-muted-foreground">
            Roles live in <code>user_roles</code> (<code>super_admin</code>, <code>admin</code>, <code>support</code>
            ). Assign via Supabase SQL. Support is view-oriented; admin/super_admin can suspend users.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">Fees / revenue</p>
          <p className="mt-1 text-muted-foreground">
            No fee ledger table exists yet, so Revenue KPI is 0. Add a fees table + migration before enabling revenue
            reporting.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
