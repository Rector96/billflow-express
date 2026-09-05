import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmpty, AdminLoading, AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { formatNaira, type TxStatus } from "@/lib/mock-data";
import { n, requireStaffSession, can } from "@/lib/admin";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin/users/$userId")({
  head: () => ({ meta: [{ title: `User — ${BRAND.name} Admin` }] }),
  component: AdminUserDetail,
});

function AdminUserDetail() {
  const { userId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [profile, setProfile] = useState<{
    full_name: string;
    email: string;
    phone: string;
    account_status: string;
    created_at: string;
    billpay_id: string;
  } | null>(null);
  const [balance, setBalance] = useState(0);
  const [summary, setSummary] = useState({
    funded: 0,
    spent: 0,
    refunds: 0,
    tx: 0,
    ok: 0,
    fail: 0,
  });
  const [txs, setTxs] = useState<
    {
      id: string;
      reference: string;
      amount: number;
      status: TxStatus;
      description: string;
      created_at: string;
      type: string;
    }[]
  >([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const staff = await requireStaffSession();
      setCanManage(can(staff.perms, "users_manage"));

      const [p, w, ledger] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
        supabase
          .from("wallet_transactions")
          .select(
            "id, reference, amount, status, description, created_at, type, provider_reference",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (p.data) {
        setProfile({
          full_name: p.data.full_name || "—",
          email: p.data.email || "—",
          phone: p.data.phone || "—",
          account_status: p.data.account_status || "active",
          created_at: p.data.created_at,
          billpay_id: p.data.billpay_id || "—",
        });
      }
      setBalance(n(w.data?.balance));

      let funded = 0,
        spent = 0,
        refunds = 0,
        ok = 0,
        fail = 0;
      const list =
        (ledger.data ?? []).map((t) => {
          const amt = n(t.amount);
          if (t.status === "successful") {
            ok++;
            if (t.type === "deposit") funded += amt;
            if (t.type === "bill_payment") spent += amt;
            if (t.type === "refund") refunds += amt;
          }
          if (t.status === "failed") fail++;
          const status: TxStatus =
            t.status === "successful" || t.status === "pending" || t.status === "failed"
              ? t.status
              : "pending";
          return {
            id: t.id,
            reference: t.provider_reference || t.reference,
            amount: amt,
            status,
            description: t.description || t.type,
            created_at: t.created_at,
            type: t.type,
          };
        }) ?? [];
      setSummary({ funded, spent, refunds, tx: list.length, ok, fail });
      setTxs(list);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (next: "active" | "suspended") => {
    if (!canManage) {
      toast.error("Your role cannot change account status.");
      return;
    }
    const reason = window.prompt(`Reason for setting status to ${next}:`) ?? "";
    if (!window.confirm(`Confirm set this user to ${next}?`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_set_account_status", {
        _user_id: userId,
        _status: next,
        _reason: reason,
      });
      if (error) throw error;
      toast.success(`Account set to ${next}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AdminShell title="User">
        <AdminLoading />
      </AdminShell>
    );
  }

  if (!profile) {
    return (
      <AdminShell title="User">
        <AdminEmpty title="User not found" body="No profile for this id." />
      </AdminShell>
    );
  }

  return (
    <AdminShell title={profile.full_name} subtitle={profile.email}>
      <Link
        to="/admin/users"
        search={{ q: "", status: "all" }}
        className="mb-4 inline-block text-xs font-bold text-primary"
      >
        ← All users
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-card lg:col-span-1">
          <p className="text-xs text-muted-foreground">Overview</p>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-semibold">{profile.phone}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-semibold capitalize">{profile.account_status}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Wallet ID</dt>
              <dd className="font-mono text-xs">{profile.billpay_id}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Registered</dt>
              <dd className="font-semibold">
                {new Date(profile.created_at).toLocaleDateString("en-NG")}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Wallet balance</dt>
              <dd className="font-extrabold">{formatNaira(balance)}</dd>
            </div>
          </dl>

          <div className="mt-4 space-y-2">
            {canManage && profile.account_status === "active" ? (
              <Button
                disabled={busy}
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => void setStatus("suspended")}
              >
                Suspend account
              </Button>
            ) : null}
            {canManage && profile.account_status !== "active" ? (
              <Button
                disabled={busy}
                className="w-full rounded-xl"
                onClick={() => void setStatus("active")}
              >
                Reactivate account
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-card lg:col-span-2">
          <p className="text-sm font-bold">Financial summary</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Total funded</p>
              <p className="font-extrabold">{formatNaira(summary.funded, false)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total spent</p>
              <p className="font-extrabold">{formatNaira(summary.spent, false)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Refunds</p>
              <p className="font-extrabold">{formatNaira(summary.refunds, false)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="font-extrabold">{summary.tx}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Successful</p>
              <p className="font-extrabold">{summary.ok}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="font-extrabold">{summary.fail}</p>
            </div>
          </div>

          <p className="mt-6 text-sm font-bold">Security</p>
          <p className="mt-1 text-xs text-muted-foreground">
            PIN hashes and passwords are never exposed to staff. PIN presence is not listed here
            because
            <code> transaction_pins </code> is service-role only by design.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border bg-card p-4 shadow-card">
        <p className="mb-3 text-sm font-bold">Transaction history</p>
        {txs.length === 0 ? (
          <AdminEmpty title="No transactions" body="This user has no wallet ledger rows yet." />
        ) : (
          <div className="space-y-2">
            {txs.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.description}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{t.reference}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("en-NG")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatNaira(t.amount, false)}</p>
                  <StatusBadge status={t.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
