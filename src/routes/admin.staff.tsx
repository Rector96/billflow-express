import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { BRAND } from "@/lib/brand";

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids)
        : { data: [] as { user_id: string; full_name: string | null; email: string | null }[] };
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell title="Staff" subtitle="Roles from user_roles (super_admin, admin, support)">
      <p className="mb-4 text-xs text-muted-foreground">
        Finance / Operations roles from the product brief are not in the database enum yet. Current roles:{" "}
        <strong>super_admin</strong>, <strong>admin</strong>, <strong>support</strong>. Grant roles via Supabase SQL
        only for now.
      </p>
      {loading ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty title="No staff roles" body="Insert into user_roles to grant access." />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={`${r.user_id}-${r.role}`} className="rounded-2xl border bg-card p-4 text-sm shadow-card">
              <p className="font-bold">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.email}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-primary">{r.role}</p>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
