import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { formatNaira, type TxStatus } from "@/lib/mock-data";
import { n } from "@/lib/admin";
import {
  buildBillTimeline,
  formatPendingDuration,
  reconcileLabel,
  reconcileVerdict,
} from "@/lib/reconciliation";
import { adminRequeryAirtime } from "@/lib/airtime.functions";
import { friendlyError } from "@/lib/app-store";
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

type BillRow = {
  id: string;
  internal_reference: string;
  service: string;
  provider: string;
  product: string | null;
  amount: number;
  status: string;
  customer_identifier: string;
  provider_request_id: string | null;
  provider_transaction_id: string | null;
  provider_status: string | null;
  provider_response_code: string | null;
  provider_response_message: string | null;
  provider_channel: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  wallet_id: string | null;
  user_label: string;
  user_email: string;
  user_phone: string;
};

type TransactionFilter = "all" | TxStatus;

const transactionFilters: TransactionFilter[] = ["all", "successful", "pending", "failed"];

const PAGE = 30;

function AdminTransactions() {
  const search = Route.useSearch();
  const requery = useServerFn(adminRequeryAirtime);
  const [q, setQ] = useState(search.q);
  const [status, setStatus] = useState<TransactionFilter>(
    ["all", "pending", "successful", "failed", "reversed"].includes(search.status)
      ? (search.status as TransactionFilter)
      : "all",
  );
  const [channel, setChannel] = useState("all");
  const [service, setService] = useState("all");
  const [dateKey, setDateKey] = useState("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BillRow[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<BillRow | null>(null);
  const [walletSnap, setWalletSnap] = useState<{
    balance_before: number;
    balance_after: number;
    amount: number;
  } | null>(null);
  const [careTicket, setCareTicket] = useState<{ id: string; ticket_number: string | null } | null>(null);
  const [requerying, setRequerying] = useState(false);

  const dateFrom = (): string | null => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateKey === "today") return start.toISOString();
    if (dateKey === "yesterday") {
      start.setDate(start.getDate() - 1);
      return start.toISOString();
    }
    if (dateKey === "7d") {
      start.setDate(start.getDate() - 6);
      return start.toISOString();
    }
    if (dateKey === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return null;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("bill_transactions")
        .select(
          "id, internal_reference, service, provider, product, amount, status, customer_identifier, provider_request_id, provider_transaction_id, provider_status, provider_response_code, provider_response_message, provider_channel, metadata, created_at, updated_at, user_id, wallet_id",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);

      if (status !== "all") query = query.eq("status", status);
      if (service === "airtime") query = query.eq("service", "Airtime");
      if (service === "data") query = query.ilike("service", "%data%");
      if (service === "electricity") query = query.ilike("service", "%electric%");
      if (service === "cable") query = query.or("service.ilike.%cable%,service.ilike.%dstv%,service.ilike.%gotv%");
      if (channel === "vtpass") query = query.or("provider_channel.eq.vtpass,metadata->>channel.eq.vtpass,product.eq.VTU");
      if (channel === "paystack") query = query.eq("provider_channel", "paystack");

      const from = dateFrom();
      if (from) {
        if (dateKey === "yesterday") {
          const end = new Date(from);
          end.setDate(end.getDate() + 1);
          query = query.gte("created_at", from).lt("created_at", end.toISOString());
        } else {
          query = query.gte("created_at", from);
        }
      }

      const term = q.trim();
      if (term) {
        query = query.or(
          [
            `internal_reference.ilike.%${term}%`,
            `provider_request_id.ilike.%${term}%`,
            `provider_transaction_id.ilike.%${term}%`,
            `customer_identifier.ilike.%${term}%`,
            `provider.ilike.%${term}%`,
          ].join(","),
        );
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setTotal(count ?? 0);

      const ids = [...new Set((data ?? []).map((t) => t.user_id))];
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name, email, phone").in("user_id", ids)
        : { data: [] as { user_id: string; full_name: string | null; email: string | null; phone: string | null }[] };
      const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

      // Client-side name/email filter when term looks like a person search
      let mapped: BillRow[] = (data ?? []).map((t) => {
        const p = pmap.get(t.user_id);
        return {
          ...(t as Omit<BillRow, "user_label" | "user_email" | "user_phone">),
          amount: n(t.amount),
          metadata: (t.metadata ?? {}) as Record<string, unknown>,
          user_label: p?.full_name || p?.email || t.user_id.slice(0, 8),
          user_email: p?.email || "",
          user_phone: p?.phone || "",
        };
      });

      if (term) {
        const low = term.toLowerCase();
        mapped = mapped.filter(
          (r) =>
            r.internal_reference.toLowerCase().includes(low) ||
            (r.provider_request_id ?? "").toLowerCase().includes(low) ||
            (r.provider_transaction_id ?? "").toLowerCase().includes(low) ||
            r.user_label.toLowerCase().includes(low) ||
            r.user_email.toLowerCase().includes(low) ||
            r.user_phone.toLowerCase().includes(low) ||
            r.customer_identifier.includes(term),
        );
      }

      setRows(mapped);
    } catch (e) {
      toast.error(friendlyError(e, "Could not load transactions"));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, channel, service, dateKey, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (search.q) setQ(search.q);
    if (transactionFilters.includes(search.status as TransactionFilter)) {
      setStatus(search.status as TransactionFilter);
    }
  }, [search.q, search.status]);

  const openDetail = async (row: BillRow) => {
    setSelected(row);
    setWalletSnap(null);
    setCareTicket(null);
    try {
      const [{ data: wt }, { data: tickets }] = await Promise.all([
        supabase
          .from("wallet_transactions")
          .select("balance_before, balance_after, amount")
          .eq("type", "bill_payment")
          .contains("metadata", { bill_reference: row.internal_reference })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("support_tickets")
          .select("id, ticket_number, status")
          .eq("transaction_id", row.id)
          .in("status", ["open", "in_progress", "waiting_for_customer"])
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      if (wt) {
        setWalletSnap({
          balance_before: n(wt.balance_before),
          balance_after: n(wt.balance_after),
          amount: n(wt.amount),
        });
      }
      const t = tickets?.[0];
      if (t) setCareTicket({ id: t.id, ticket_number: t.ticket_number });
    } catch {
      /* non-fatal */
    }
  };

  const runRequery = async () => {
    if (!selected) return;
    setRequerying(true);
    try {
      const res = await requery({ data: { reference: selected.internal_reference } });
      toast.success(`Requery: ${res.status}`);
      await load();
      const { data } = await supabase
        .from("bill_transactions")
        .select(
          "id, internal_reference, service, provider, product, amount, status, customer_identifier, provider_request_id, provider_transaction_id, provider_status, provider_response_code, provider_response_message, provider_channel, metadata, created_at, updated_at, user_id, wallet_id",
        )
        .eq("internal_reference", selected.internal_reference)
        .maybeSingle();
      if (data) {
        await openDetail({
          ...(data as BillRow),
          amount: n(data.amount),
          metadata: (data.metadata ?? {}) as Record<string, unknown>,
          user_label: selected.user_label,
          user_email: selected.user_email,
          user_phone: selected.user_phone,
        });
      }
    } catch (e) {
      toast.error(friendlyError(e, "Requery failed"));
    } finally {
      setRequerying(false);
    }
  };

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v);
    toast.success("Copied");
  };

  const st = (s: string): TxStatus =>
    s === "successful" || s === "pending" || s === "failed" ? s : "pending";

  return (
    <AdminShell title="Transactions" subtitle={`${total} bill rows`}>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Name, email, phone, BIL-, VTpass id…"
          className="h-10 min-w-[200px] flex-1 rounded-xl border bg-card px-3 text-sm"
        />
        {["all", "successful", "pending", "failed"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s as TransactionFilter);
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
        {["all", "vtpass", "paystack"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setChannel(p);
              setPage(0);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold capitalize",
              channel === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {p}
          </button>
        ))}
        {["all", "airtime", "data", "electricity", "cable"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setService(s);
              setPage(0);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold capitalize",
              service === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {s}
          </button>
        ))}
        {["all", "today", "yesterday", "7d", "month"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setDateKey(d);
              setPage(0);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold capitalize",
              dateKey === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {d === "7d" ? "7 days" : d}
          </button>
        ))}
        <Link to="/admin/reconciliation" className="rounded-full border px-3 py-1 text-xs font-bold">
          Reconciliation queue
        </Link>
      </div>

      {loading ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty title="No transactions" body="No bill rows match these filters." />
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void openDetail(t)}
              className="w-full rounded-2xl border bg-card p-4 text-left text-sm shadow-card press"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold">
                    {t.service} · {t.provider}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.user_label}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{t.internal_reference}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.provider_channel || "—"} · {new Date(t.created_at).toLocaleString("en-NG")}
                    {t.status === "pending" ? ` · ${formatPendingDuration(t.created_at)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold">{formatNaira(t.amount, false)}</p>
                  <StatusBadge status={st(t.status)} />
                </div>
              </div>
            </button>
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

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog">
          <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => setSelected(null)} />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l bg-background shadow-float">
            <div className="sticky top-0 flex items-center justify-between border-b bg-background px-4 py-3">
              <div>
                <p className="text-sm font-extrabold">Investigation</p>
                <p className="font-mono text-[10px] text-muted-foreground">{selected.internal_reference}</p>
              </div>
              <button type="button" className="grid size-9 place-items-center rounded-xl border" onClick={() => setSelected(null)}>
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 p-4 text-sm">
              <div className="flex items-center justify-between">
                <StatusBadge status={st(selected.status)} />
                <span className="text-xs font-bold">
                  {reconcileLabel(
                    reconcileVerdict(selected.status, selected.provider_status, selected.provider_response_code),
                  )}
                </span>
              </div>

              <section className="space-y-1 rounded-xl border p-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Customer</p>
                <p className="font-bold">{selected.user_label}</p>
                {selected.user_email ? <p className="text-xs text-muted-foreground">{selected.user_email}</p> : null}
                {selected.user_phone ? <p className="text-xs text-muted-foreground">{selected.user_phone}</p> : null}
                <Link
                  to="/admin/users/$userId"
                  params={{ userId: selected.user_id }}
                  search={{ q: "", status: "all" }}
                  className="text-xs font-bold text-primary"
                >
                  Open profile
                </Link>
              </section>

              <section className="space-y-1 rounded-xl border p-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Transaction</p>
                <Row k="Service" v={selected.service} />
                <Row k="Network" v={selected.provider} />
                <Row k="Amount" v={formatNaira(selected.amount, false)} />
                <Row k="Customer id" v={selected.customer_identifier} />
                <CopyRow k="RockPay ref" v={selected.internal_reference} onCopy={copy} />
                <Row k="Provider" v={selected.provider_channel === "vtpass" ? "VTpass" : selected.provider_channel || "—"} />
                <CopyRow k="VTpass request ID" v={selected.provider_request_id || "—"} onCopy={copy} />
                <CopyRow k="VTpass transaction ID" v={selected.provider_transaction_id || "—"} onCopy={copy} />
                <Row k="Created" v={new Date(selected.created_at).toLocaleString("en-NG")} />
                <Row k="Updated" v={new Date(selected.updated_at).toLocaleString("en-NG")} />
              </section>

              {walletSnap ? (
                <section className="space-y-1 rounded-xl border p-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Wallet</p>
                  <Row k="Before" v={formatNaira(walletSnap.balance_before, false)} />
                  <Row k="Debit" v={formatNaira(walletSnap.amount, false)} />
                  <Row k="After" v={formatNaira(walletSnap.balance_after, false)} />
                </section>
              ) : null}

              <section className="space-y-1 rounded-xl border p-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Provider status</p>
                <Row k="Status" v={selected.provider_status || "—"} />
                <Row k="Code" v={selected.provider_response_code || "—"} />
                <Row k="Message" v={selected.provider_response_message || "—"} />
              </section>

              <section className="space-y-2 rounded-xl border p-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Timeline</p>
                {buildBillTimeline({
                  createdAt: selected.created_at,
                  updatedAt: selected.updated_at,
                  status: selected.status,
                  hasProviderRequestId: Boolean(selected.provider_request_id),
                  providerStatus: selected.provider_status,
                }).map((step) => (
                  <div key={step.key} className="flex gap-2 text-xs">
                    <span className={cn("mt-1 size-2 shrink-0 rounded-full", step.done ? "bg-primary" : "bg-muted")} />
                    <div>
                      <p className="font-semibold">{step.label}</p>
                      {step.at ? (
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(step.at).toLocaleString("en-NG")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground">
                  Timeline uses stored created/updated times only — no fabricated events.
                </p>
              </section>

              <div className="space-y-2">
                {(selected.product === "VTU" || selected.service === "Airtime") && selected.provider_request_id ? (
                  <Button className="h-11 w-full rounded-xl font-bold" disabled={requerying} onClick={() => void runRequery()}>
                    {requerying ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Requery Provider
                  </Button>
                ) : null}
                {careTicket ? (
                  <Link
                    to="/admin/care/$ticketId"
                    params={{ ticketId: careTicket.id }}
                    className="flex h-11 items-center justify-center rounded-xl border text-xs font-bold"
                  >
                    Existing Care · {careTicket.ticket_number ?? careTicket.id.slice(0, 8)}
                  </Link>
                ) : (
                  <Link
                    to="/admin/care"
                    search={{ q: selected.internal_reference }}
                    className="flex h-11 items-center justify-center rounded-xl border text-xs font-bold"
                  >
                    Open RockPay Care
                  </Link>
                )}
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl font-bold"
                  onClick={() =>
                    copy(
                      [
                        selected.internal_reference,
                        selected.provider_request_id,
                        selected.provider_transaction_id,
                      ]
                        .filter(Boolean)
                        .join("\n"),
                    )
                  }
                >
                  <Copy className="size-3.5" /> Copy references
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 py-0.5 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="max-w-[60%] text-right font-semibold break-all">{v}</span>
    </div>
  );
}

function CopyRow({ k, v, onCopy }: { k: string; v: string; onCopy: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <button
        type="button"
        className="max-w-[65%] truncate text-right font-mono font-semibold text-primary"
        onClick={() => v !== "—" && onCopy(v)}
      >
        {v}
      </button>
    </div>
  );
}
