import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin/audit-logs")({
  head: () => ({ meta: [{ title: `Audit logs — ${BRAND.name} Admin` }] }),
  component: AdminAuditLogs,
});

type Log = {
  id: string;
  action: string;
  description: string;
  target_type: string | null;
  target_id: string | null;
  actor_user_id: string;
  created_at: string;
  actor_label: string;
};

function AdminAuditLogs() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("admin_audit_logs")
        .select("id, action, description, target_type, target_id, actor_user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (err) {
        setError(err.message);
        setRows([]);
        return;
      }
      const actors = [...new Set((data ?? []).map((r) => r.actor_user_id))];
      const { data: profiles } = actors.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", actors)
        : { data: [] as { user_id: string; full_name: string | null; email: string | null }[] };
      const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      setRows(
        (data ?? []).map((r) => {
          const p = pmap.get(r.actor_user_id);
          return {
            ...r,
            actor_label: p?.full_name || p?.email || r.actor_user_id.slice(0, 8),
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
    <AdminShell title="Audit logs" subtitle="Staff actions — view only from this UI">
      <p className="mb-4 text-xs text-muted-foreground">
        Logs are written by secure server RPCs. There is no delete/edit control here.
      </p>
      {error ? (
        <p className="mb-3 text-sm text-destructive">
          {error}. Apply migration <code>20260814140000_admin_ops_platform.sql</code> if the table
          is missing.
        </p>
      ) : null}
      {loading ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty
          title="No audit events yet"
          body="Suspend/reactivate and other staff actions will appear here."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-4 text-sm shadow-card">
              <p className="font-bold">{r.action}</p>
              <p className="text-xs text-muted-foreground">by {r.actor_label}</p>
              <p className="mt-1">{r.description}</p>
              {r.target_type ? (
                <p className="font-mono text-[11px] text-muted-foreground">
                  {r.target_type}:{r.target_id}
                </p>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString("en-NG")}
              </p>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
