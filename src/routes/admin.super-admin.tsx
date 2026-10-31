import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin/super-admin")({
  beforeLoad: async () => {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) throw redirect({ to: "/login" });
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error || !(data ?? []).some((r) => r.role === "super_admin")) throw redirect({ to: "/admin" });
  },
  head: () => ({ meta: [{ title: `Super Admin — ${BRAND.name}` }] }),
  component: SuperAdminCentre,
});

type StaffRow = { user_id: string; role: string; name: string; email: string };

function SuperAdminCentre() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "support">("support");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: roles, error: roleError } = await supabase.from("user_roles").select("user_id, role");
      if (roleError) throw roleError;
      const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
      const { data: profiles, error: profileError } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      setRows((roles ?? []).map((r) => ({
        user_id: r.user_id, role: String(r.role),
        name: byId.get(r.user_id)?.full_name || "—",
        email: byId.get(r.user_id)?.email || "—",
      })));
    } catch (e) { setRows([]); setError(e instanceof Error ? e.message : "Could not load staff"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const grant = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null); setNotice(null);
    try {
      const { error: rpcError } = await supabase.rpc("admin_grant_staff_role", { _email: email.trim().toLowerCase(), _role: role });
      if (rpcError) throw rpcError;
      setEmail(""); setNotice(`${role === "admin" ? "Admin" : "Customer Care"} access granted.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not grant role"); }
    finally { setBusy(false); }
  };

  const remove = async (userId: string, targetRole: string) => {
    if (!window.confirm(`Remove ${targetRole} access from this staff member?`)) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const { error: rpcError } = await supabase.rpc("admin_remove_staff_role", { _user_id: userId, _role: targetRole });
      if (rpcError) throw rpcError;
      setNotice(`${targetRole} access removed.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove role"); }
    finally { setBusy(false); }
  };

  return (
    <AdminShell title="Super Admin" subtitle="Owner-only staff access and platform governance">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Authority</p><p className="mt-1 text-lg font-black">Owner level</p><p className="mt-1 text-xs text-muted-foreground">Only super_admin can open this centre.</p></div>
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Staff roles</p><p className="mt-1 text-lg font-black">{rows.length}</p><p className="mt-1 text-xs text-muted-foreground">Current role assignments.</p></div>
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Financial controls</p><p className="mt-1 text-lg font-black">Restricted</p><p className="mt-1 text-xs text-muted-foreground">Wallet adjustments and reversals remain separately guarded.</p></div>
      </div>
      <section className="rounded-2xl border bg-card p-4 shadow-card">
        <h2 className="text-sm font-extrabold">Grant staff access</h2><p className="mt-1 text-xs text-muted-foreground">The person must already have a RockPay account. Super Admin role cannot be granted here.</p>
        <form onSubmit={grant} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Existing account email" className="h-11 min-w-0 rounded-xl border bg-background px-3 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "support")} className="h-11 rounded-xl border bg-background px-3 text-sm"><option value="support">Customer Care</option><option value="admin">Admin</option></select>
          <button disabled={busy} className="h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? "Please wait…" : "Grant access"}</button>
        </form>
      </section>
      {error ? <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">{notice}</p> : null}
      <section className="mt-4 rounded-2xl border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-extrabold">Staff directory</h2><button onClick={() => void load()} className="rounded-lg border px-3 py-2 text-xs font-bold">Refresh</button></div>
        {loading ? <AdminLoading label="Loading staff…" /> : rows.length === 0 ? <AdminEmpty title="No staff roles found" body="Staff assignments will appear here." /> : <div className="space-y-2">{rows.map((r) => <div key={r.user_id + r.role} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{r.name}</p><p className="truncate text-xs text-muted-foreground">{r.email}</p><p className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-primary">{r.role.replace("_", " ")}</p></div>{r.role !== "super_admin" ? <button disabled={busy} onClick={() => void remove(r.user_id, r.role)} className="rounded-lg border border-destructive/30 px-3 py-2 text-xs font-bold text-destructive disabled:opacity-50">Remove role</button> : <span className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary">Protected owner</span>}</div>)}</div>}
      </section>
      <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"><p className="text-xs font-bold">Security boundaries</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">This page can assign Admin or Customer Care roles to existing users and remove those roles. It cannot create or remove Super Admin accounts. All role changes are checked by database functions and written to the admin audit log. Never share account passwords or provider secrets with staff.</p></div>
    </AdminShell>
  );
}
