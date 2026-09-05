import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { formatNaira } from "@/lib/mock-data";
import { n } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: `Users — ${BRAND.name} Admin` }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s["q"] === "string" ? s["q"] : "",
    status: typeof s["status"] === "string" ? s["status"] : "all",
  }),
  component: AdminUsers,
});

type UserRow = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  account_status: string;
  created_at: string;
  balance: number;
  tx_count: number;
};

function AdminUsers() {
  const { q: initialQ, status: initialStatus } = Route.useSearch();
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus || "all");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profiles, wallets, txs] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, email, phone, account_status, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("wallets").select("user_id, balance").limit(1000),
        supabase.from("wallet_transactions").select("user_id").limit(5000),
      ]);

      const bal = new Map<string, number>();
      for (const w of wallets.data ?? []) bal.set(w.user_id, n(w.balance));

      const counts = new Map<string, number>();
      for (const t of txs.data ?? []) {
        counts.set(t.user_id, (counts.get(t.user_id) ?? 0) + 1);
      }

      setRows(
        (profiles.data ?? []).map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name || "—",
          email: p.email || "—",
          phone: p.phone || "—",
          account_status: p.account_status || "active",
          created_at: p.created_at,
          balance: bal.get(p.user_id) ?? 0,
          tx_count: counts.get(p.user_id) ?? 0,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.account_status !== status) return false;
      if (!term) return true;
      return (
        r.full_name.toLowerCase().includes(term) ||
        r.email.toLowerCase().includes(term) ||
        r.phone.toLowerCase().includes(term) ||
        r.user_id.toLowerCase().includes(term)
      );
    });
  }, [rows, q, status]);

  return (
    <AdminShell title="Users" subtitle={`${filtered.length} of ${rows.length} profiles`}>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, phone…"
          className="h-10 min-w-[200px] flex-1 rounded-xl border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        {["all", "active", "suspended", "closed"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold capitalize",
              status === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminLoading />
      ) : filtered.length === 0 ? (
        <AdminEmpty title="No users found" body="Try another search or status filter." />
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <Link
              key={u.user_id}
              to="/admin/users/$userId"
              params={{ userId: u.user_id }}
              search={{ q: "", status: "all" }}
              className="block rounded-2xl border bg-card p-4 shadow-card transition-colors hover:border-primary/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{u.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.phone}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-extrabold">{formatNaira(u.balance, false)}</p>
                  <p className="text-xs text-muted-foreground">{u.tx_count} txs</p>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      u.account_status === "active"
                        ? "bg-success-soft text-success"
                        : "bg-warning-soft text-warning",
                    )}
                  >
                    {u.account_status}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Joined {new Date(u.created_at).toLocaleDateString("en-NG")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
