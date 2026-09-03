import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { can, requireStaffSession } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: `Settings — ${BRAND.name} Admin` }] }),
  beforeLoad: async () => {
    const staff = await requireStaffSession();
    if (!can(staff.perms, "settings")) {
      throw redirect({ to: "/admin" });
    }
  },
  component: AdminSettings,
});

type MarkupType = "fixed" | "percentage" | "selling_price";
type PricingService = "airtime" | "data" | "cable" | "electricity";

type PricingRule = {
  id: string;
  service: PricingService;
  provider: string | null;
  product_code: string | null;
  markup_type: MarkupType;
  markup_value: number;
  min_amount: number | null;
  max_amount: number | null;
  is_active: boolean;
  priority: number;
};

type Draft = {
  service: PricingService;
  provider: string;
  product_code: string;
  markup_type: MarkupType;
  markup_value: string;
  min_amount: string;
  max_amount: string;
  priority: string;
  is_active: boolean;
};

const emptyDraft = (): Draft => ({
  service: "airtime",
  provider: "",
  product_code: "",
  markup_type: "fixed",
  markup_value: "5",
  min_amount: "",
  max_amount: "",
  priority: "0",
  is_active: true,
});

function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const db = supabase as any;
      const { data, error } = await db
        .from("pricing_rules")
        .select(
          "id, service, provider, product_code, markup_type, markup_value, min_amount, max_amount, is_active, priority",
        )
        .order("service", { ascending: true })
        .order("priority", { ascending: false });
      if (error) throw error;
      setRules((data as PricingRule[]) ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load pricing rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addRule = async () => {
    const value = Number(draft.markup_value);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Markup value must be a number ≥ 0");
      return;
    }
    setSaving(true);
    try {
      const db = supabase as any;
      const { error } = await db.from("pricing_rules").insert({
        service: draft.service,
        provider: draft.provider.trim() || null,
        product_code: draft.product_code.trim() || null,
        markup_type: draft.markup_type,
        markup_value: value,
        min_amount: draft.min_amount.trim() ? Number(draft.min_amount) : null,
        max_amount: draft.max_amount.trim() ? Number(draft.max_amount) : null,
        priority: Number(draft.priority) || 0,
        is_active: draft.is_active,
      });
      if (error) throw error;
      toast.success("Pricing rule added");
      setDraft(emptyDraft());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save rule");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: PricingRule) => {
    const db = supabase as any;
    const { error } = await db
      .from("pricing_rules")
      .update({ is_active: !rule.is_active })
      .eq("id", rule.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  };

  const removeRule = async (id: string) => {
    if (!window.confirm("Delete this pricing rule?")) return;
    const db = supabase as any;
    const { error } = await db.from("pricing_rules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rule deleted");
    await load();
  };

  return (
    <AdminShell title="Settings" subtitle="Pricing rules and operational notes">
      <div className="space-y-6 text-sm">
        <section className="rounded-2xl border bg-card p-4 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold">Pricing rules</p>
              <p className="text-xs text-muted-foreground">
                Customer pay = provider amount + markup (or selling price). Empty provider/product matches all of that
                service. Higher priority wins.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg text-xs font-bold"
              onClick={() => void load()}
            >
              Reload
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading rules…
            </div>
          ) : rules.length === 0 ? (
            <p className="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              No rules yet. Payments use provider cost only (fallback). Add a rule below or run the seed SQL in
              Supabase.
            </p>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold capitalize">
                      {r.service}
                      {!r.is_active ? (
                        <span className="ml-2 text-[10px] font-bold uppercase text-muted-foreground">off</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.provider || "any provider"}
                      {r.product_code ? ` · ${r.product_code}` : ""} · {r.markup_type} {r.markup_value}
                      {" · priority "}
                      {r.priority}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => void toggleActive(r)}
                    >
                      {r.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs text-destructive"
                      onClick={() => void removeRule(r.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-2 border-t border-border/60 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-semibold">
              Service
              <select
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
                value={draft.service}
                onChange={(e) => setDraft((d) => ({ ...d, service: e.target.value as PricingService }))}
              >
                <option value="airtime">Airtime</option>
                <option value="data">Data</option>
                <option value="cable">Cable</option>
                <option value="electricity">Electricity</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              Provider (optional)
              <input
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
                placeholder="mtn, dstv, ikeja-electric"
                value={draft.provider}
                onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold">
              Product code (optional)
              <input
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
                placeholder="variation / plan code"
                value={draft.product_code}
                onChange={(e) => setDraft((d) => ({ ...d, product_code: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold">
              Markup type
              <select
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
                value={draft.markup_type}
                onChange={(e) => setDraft((d) => ({ ...d, markup_type: e.target.value as MarkupType }))}
              >
                <option value="fixed">Fixed ₦</option>
                <option value="percentage">Percentage %</option>
                <option value="selling_price">Selling price ₦</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              Markup value
              <input
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
                inputMode="decimal"
                value={draft.markup_value}
                onChange={(e) => setDraft((d) => ({ ...d, markup_value: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold">
              Priority
              <input
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
                inputMode="numeric"
                value={draft.priority}
                onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
              />
            </label>
          </div>
          <Button
            type="button"
            className="mt-3 h-11 w-full rounded-xl font-bold sm:w-auto sm:px-6"
            disabled={saving}
            onClick={() => void addRule()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add rule
          </Button>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">Paystack</p>
          <p className="mt-1 text-muted-foreground">
            Test mode is enforced in server code (<code>sk_test_</code> only). Secret keys are set on Netlify, never in
            the browser.
          </p>
        </section>
        <section className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-bold">Staff access</p>
          <p className="mt-1 text-muted-foreground">
            Roles live in <code>user_roles</code> (<code>super_admin</code>, <code>admin</code>, <code>support</code>).
            Only admin / super_admin can edit pricing rules (RLS). Support cannot open this page.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}
