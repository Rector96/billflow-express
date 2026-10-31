import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { BRAND } from "@/lib/brand";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/staff")({
  head: () => ({ meta: [{ title: `Staff — ${BRAND.name} Admin` }] }),
  component: AdminStaff,
});

type StaffRow = {
  user_id: string;
  role: string;
  name: string;
  email: string;
};

function AdminStaff() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: current } = await supabase.auth.getUser();
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      setIsSuperAdmin((roles ?? []).some((r) => r.user_id === current.user?.id && r.role === "super_admin"));
      if (rolesError) throw rolesError;
      const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
      const { data: profiles, error: profilesError } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids)
        : {
            data: [] as { user_id: string; full_name: string | null; email: string | null }[],
            error: null,
          };
      if (profilesError) throw profilesError;
      const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      setRows(
        (roles ?? []).map((r) => {
          const p = pmap.get(r.user_id);
          return {
            user_id: r.user_id,
            role: r.role,
            name: p?.full_name || "—",
            email: p?.email || "—",
          };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load staff roles");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell title="Staff" subtitle="Roles from user_roles (super_admin, admin, support)">
      {isSuperAdmin ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div><p className="text-sm font-extrabold">Owner controls</p><p className="mt-1 text-xs text-muted-foreground">Manage staff access and review privileged controls in the Super Admin centre.</p></div>
          <Link to="/admin/super-admin" className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">Open Super Admin</Link>
        </div>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p className="mb-4 text-xs text-muted-foreground">
        Finance / Operations roles from the product brief are not in the database enum yet. Current
        roles: <strong>super_admin</strong>, <strong>admin</strong>, <strong>support</strong>. Role changes are available only in the Super Admin centre. Super Admin access itself remains protected and cannot be granted from this screen.
      </p>
      {loading ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty title="No staff roles" body="Insert into user_roles to grant access." />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={`${r.user_id}-${r.role}`}
              className="rounded-2xl border bg-card p-4 text-sm shadow-card"
            >
              <p className="font-bold">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.email}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-primary">
                {r.role}
              </p>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
