import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: `Reports — ${BRAND.name} Admin` }] }),
  component: AdminReports,
});

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    toast.error("No rows to export");
    return;
  }
  const keys = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Export started");
}

function AdminReports() {
  const [busy, setBusy] = useState(false);

  const exportTx = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select(
          "reference, provider_reference, type, amount, status, provider, description, created_at, user_id",
        )
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      downloadCsv(`transactions-${new Date().toISOString().slice(0, 10)}.csv`, data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const exportUsers = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, phone, account_status, billpay_id, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      downloadCsv(`users-${new Date().toISOString().slice(0, 10)}.csv`, data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const exportFunding = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("reference, provider_reference, amount, status, created_at, user_id")
        .eq("type", "deposit")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      downloadCsv(`funding-${new Date().toISOString().slice(0, 10)}.csv`, data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <AdminShell title="Reports" subtitle="CSV exports from live tables (no secrets)">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">Transactions</p>
          <p className="mt-1 text-xs text-muted-foreground">Up to 2000 wallet ledger rows</p>
          <Button
            disabled={busy}
            className="mt-4 w-full rounded-xl"
            onClick={() => void exportTx()}
          >
            Export CSV
          </Button>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">Users</p>
          <p className="mt-1 text-xs text-muted-foreground">Profiles only — no passwords or PINs</p>
          <Button
            disabled={busy}
            className="mt-4 w-full rounded-xl"
            onClick={() => void exportUsers()}
          >
            Export CSV
          </Button>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">Wallet funding</p>
          <p className="mt-1 text-xs text-muted-foreground">Deposit rows (Paystack + other)</p>
          <Button
            disabled={busy}
            className="mt-4 w-full rounded-xl"
            onClick={() => void exportFunding()}
          >
            Export CSV
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}
