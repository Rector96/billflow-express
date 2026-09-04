import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/app/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { formatNaira } from "@/lib/mock-data";
import { n } from "@/lib/admin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/transactions")({
  head: () => ({ meta: [{ title: `Transactions — ${BRAND.name} Admin` }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s["q"] === "string" ? s["q"] : "",
    status: typeof s["status"] === "string" ? s["status"] : "all",
  }),
  component: AdminTransactions,
});

type Transaction = {
  id: string;
  reference: string;
  userId: string;
  service: string;
  provider: string;
  identifier: string;
  amount: number;
  status: "successful" | "pending" | "failed";
  kind: "bill" | "wallet";
  createdAt: string;
};

function AdminTransactions() {
  const search = Route.useSearch();
  const [query, setQuery] = useState(search.q);
  const [status, setStatus] = useState(search.status || "all");
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bills, ledger] = await Promise.all([
        supabase
          .from("bill_transactions")
          .select(
            "id, internal_reference, user_id, service, provider, customer_identifier, amount, status, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("wallet_transactions")
          .select("id, reference, user_id, type, description, provider, amount, status, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (bills.error) throw bills.error;
      if (ledger.error) throw ledger.error;
      const billRows: Transaction[] = (bills.data ?? []).map((row) => ({
        id: row.id,
        reference: row.internal_reference,
        userId: row.user_id,
        service: row.service,
        provider: row.provider,
        identifier: row.customer_identifier,
        amount: n(row.amount),
        status: row.status === "successful" || row.status === "failed" ? row.status : "pending",
        kind: "bill",
        createdAt: row.created_at,
      }));
      const ledgerRows: Transaction[] = (ledger.data ?? []).map((row) => ({
        id: row.id,
        reference: row.reference,
        userId: row.user_id,
        service: row.description || row.type,
        provider: row.provider || "—",
        identifier: row.type,
        amount: n(row.amount),
        status: row.status === "successful" || row.status === "failed" ? row.status : "pending",
        kind: "wallet",
        createdAt: row.created_at,
      }));
      setRows([...billRows, ...ledgerRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load transactions");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      return (
        !term ||
        `${row.reference} ${row.userId} ${row.service} ${row.provider} ${row.identifier}`
          .toLowerCase()
          .includes(term)
      );
    });
  }, [query, rows, status]);

  return (
    <AdminShell
      title="Transactions"
      subtitle={`${filtered.length} of ${rows.length} recent ledger and bill records`}
      actions={
        <button
          type="button"
          onClick={() => void load()}
          className="press grid size-10 place-items-center rounded-xl border bg-card"
          aria-label="Refresh transactions"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Reference, user, provider…"
            className="h-10 w-full rounded-xl border bg-card pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        {(["all", "successful", "pending", "failed"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={cn(
              "rounded-full px-3 py-2 text-xs font-bold capitalize",
              status === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {value}
          </button>
        ))}
      </div>
      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {loading ? (
        <AdminLoading label="Loading transactions…" />
      ) : filtered.length === 0 ? (
        <AdminEmpty
          title="No transactions found"
          body="Try another reference, user, provider, or status."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Reference</th>
                <th className="px-3 py-2.5">Service</th>
                <th className="px-3 py-2.5">Customer / User</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={`${row.kind}-${row.id}`}
                  className="border-b border-border/60 hover:bg-muted/40"
                >
                  <td className="px-3 py-2.5">
                    <p className="font-mono text-xs font-bold">{row.reference}</p>
                    <p className="text-[10px] text-muted-foreground">{row.kind}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold">{row.service}</p>
                    <p className="text-xs text-muted-foreground">{row.provider}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="max-w-[210px] truncate text-xs">{row.identifier}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{row.userId}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-extrabold tabular-nums">
                    {formatNaira(row.amount, false)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString("en-NG")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
