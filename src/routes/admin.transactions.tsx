import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/app/ui-bits";
import { formatNaira, type TxStatus } from "@/lib/mock-data";
import { n } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin/transactions")({
  head: () => ({ meta: [{ title: `Transactions — ${BRAND.name} Admin` }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s["q"] === "string" ? s["q"] : "",
    status: typeof s["status"] === "string" ? s["status"] : "all",
  }),
  component: AdminTransactions,
});

type Row = {
  id: string;
  reference: string;
  amount: number;
  status: TxStatus;
  type: string;
  provider: string;
  description: string;
  created_at: string;
  user_label: string;
  user_id: string;
};

const PAGE = 40;

function AdminTransactions() {
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q);
  const [status, setStatus] = useState(search.status || "all");
  const [provider, setProvider] = useState("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("wallet_transactions")
        .select(
          "id, reference, amount, status, type, provider, provider_reference, description, created_at, user_id, metadata",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);

      if (status !== "all") query = query.eq("status", status);
      if (provider === "paystack") query = query.eq("provider", "paystack");
      if (provider === "wallet") query = query.is("provider", null);

      const { data, count } = await query;
      setTotal(count ?? 0);

      const ids = [...new Set((data ?? []).map((t) => t.user_id))];
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids)
        : { data: [] as { user_id: string; full_name: string | null; email: string | null }[] };
      const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

      setRows(
        (data ?? []).map((t) => {
          const p = pmap.get(t.user_id);
          const meta = (t.metadata ?? {}) as Record<string, unknown>;
          const st: TxStatus =
            t.status === "successful" || t.status === "pending" || t.status === "failed" ? t.status : "pending";
          return {
            id: t.id,
            reference: t.provider_reference || t.reference,
            amount: n(t.amount),
            status: st,
            type: t.type,
            provider: t.provider || "wallet",
            description:
              (typeof meta["title"] === "string" ? meta["title"] : null) ||
              t.description ||
              t.type,
            created_at: t.created_at,
            user_label: p?.full_name || p?.email || t.user_id.slice(0, 8),
            user_id: t.user_id,
          };
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [page, status, provider]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.reference.toLowerCase().includes(term) ||
        r.user_label.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        r.user_id.toLowerCase().includes(term),
    );
  }, [rows, q]);

  return (
    <AdminShell title="Transactions" subtitle={`${total} ledger rows`}>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reference or user…"
          className="h-10 min-w-[180px] flex-1 rounded-xl border bg-card px-3 text-sm"
        />
        {["all", "successful", "pending", "failed"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s);
              setPage(0);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold capitalize",
              status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {s}
          </button>
        ))}
        {["all", "paystack", "wallet"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setProvider(p);
              setPage(0);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold capitalize",
              provider === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminLoading />
      ) : filtered.length === 0 ? (
        <AdminEmpty title="No transactions" body="No ledger rows match these filters." />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div key={t.id} className="rounded-2xl border bg-card p-4 text-sm shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{t.user_label}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{t.reference}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.provider} · {t.type} · {new Date(t.created_at).toLocaleString("en-NG")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold">{formatNaira(t.amount, false)}</p>
                  <StatusBadge status={t.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-xs text-muted-foreground">
          Page {page + 1} · {PAGE} / page
        </span>
        <button
          type="button"
          disabled={(page + 1) * PAGE >= total}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </AdminShell>
  );
}
