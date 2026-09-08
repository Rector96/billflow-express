import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
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

const PAGE_SIZE = 50;

type DirectoryRow = UserRow & { total_count: number };

function AdminUsers() {
  const { q: initialQ, status: initialStatus } = Route.useSearch();
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus || "all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase.rpc("admin_user_directory", {
        _query: q.trim(),
        _status: status,
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      if (queryError) throw queryError;

      const directory = (data ?? []) as DirectoryRow[];
      setRows(
        directory.map((u) => ({
          user_id: u.user_id,
          full_name: u.full_name || "—",
          email: u.email || "—",
          phone: u.phone || "—",
          account_status: u.account_status || "active",
          created_at: u.created_at,
          balance: n(u.balance),
          tx_count: n(u.tx_count),
        })),
      );
      setTotal(n(directory[0]?.total_count));
    } catch (e) {
      setRows([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : "Could not load customers");
    } finally {
      setLoading(false);
    }
  }, [page, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrevious = page > 0;
  const canNext = page + 1 < pageCount;
  const first = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <AdminShell
      title="Users"
      subtitle={total === 0 ? "No matching customers" : `${first}–${last} of ${total} customers`}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Search name, email, phone, user ID…"
          className="h-10 min-w-[220px] flex-1 rounded-xl border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        {["all", "active", "suspended", "closed"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s);
              setPage(0);
            }}
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
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border bg-card px-3 py-2 text-xs font-bold"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {error}. If this is a database function error, apply the latest admin hardening migration.
        </div>
      ) : null}

      {loading ? (
        <AdminLoading label="Loading customers…" />
      ) : rows.length === 0 ? (
        <AdminEmpty title="No users found" body="Try another search or status filter." />
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((u) => (
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

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} of {pageCount}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canPrevious || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canNext || loading}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
