import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/app/ui-bits";
import { formatNaira, type TxStatus } from "@/lib/mock-data";
import { n } from "@/lib/admin";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin/activity")({
  head: () => ({ meta: [{ title: `Activity — ${BRAND.name} Admin` }] }),
  component: AdminActivity,
});

type Item = {
  id: string;
  kind: string;
  user: string;
  detail: string;
  amount?: number;
  reference?: string;
  status?: TxStatus;
  at: string;
};

function AdminActivity() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tx, profiles] = await Promise.all([
        supabase
          .from("wallet_transactions")
          .select(
            "id, reference, amount, status, type, description, created_at, user_id, provider_reference, metadata",
          )
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("profiles")
          .select("user_id, full_name, email, created_at")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (tx.error) throw tx.error;
      if (profiles.error) throw profiles.error;

      const pmap = new Map((profiles.data ?? []).map((p) => [p.user_id, p]));
      const out: Item[] = [];

      for (const t of tx.data ?? []) {
        const p = pmap.get(t.user_id);
        const st: TxStatus =
          t.status === "successful" || t.status === "pending" || t.status === "failed"
            ? t.status
            : "pending";
        out.push({
          id: t.id,
          kind:
            t.type === "deposit"
              ? "Wallet funded"
              : t.type === "bill_payment"
                ? "Wallet debit"
                : t.type,
          user: p?.full_name || p?.email || t.user_id.slice(0, 8),
          detail: t.description || String((t.metadata as Record<string, unknown>)?.["title"] ?? ""),
          amount: n(t.amount),
          reference: t.provider_reference || t.reference,
          status: st,
          at: t.created_at,
        });
      }

      for (const p of profiles.data ?? []) {
        out.push({
          id: `reg-${p.user_id}`,
          kind: "User registered",
          user: p.full_name || p.email || p.user_id.slice(0, 8),
          detail: p.email || "",
          at: p.created_at,
        });
      }

      out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setItems(out.slice(0, 100));
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Could not load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell title="Activity" subtitle="Recent platform events from the database">
      <p className="mb-4 text-xs text-muted-foreground">
        Login events are not stored in-app yet (Supabase Auth only). Shown: registrations and wallet
        ledger activity.
      </p>
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}{" "}
          <button type="button" className="ml-2 underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : null}
      {loading ? (
        <AdminLoading />
      ) : items.length === 0 ? (
        <AdminEmpty title="No activity" body="Events appear as users and payments occur." />
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="rounded-2xl border bg-card p-4 text-sm shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{i.kind}</p>
                  <p className="text-xs text-muted-foreground">{i.user}</p>
                  {i.detail ? <p className="text-xs">{i.detail}</p> : null}
                  {i.reference ? (
                    <p className="font-mono text-[11px] text-muted-foreground">{i.reference}</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(i.at).toLocaleString("en-NG")}
                  </p>
                </div>
                <div className="text-right">
                  {i.amount != null ? (
                    <p className="font-extrabold">{formatNaira(i.amount, false)}</p>
                  ) : null}
                  {i.status ? <StatusBadge status={i.status} /> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
