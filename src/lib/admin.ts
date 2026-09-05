import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Roles that exist in public.app_role enum today. */
export type StaffRole = "super_admin" | "admin" | "support";

export type AdminPerm = "view" | "users_manage" | "staff_manage" | "wallet_adjust" | "settings";

const ROLE_PERMS: Record<StaffRole, AdminPerm[]> = {
  super_admin: ["view", "users_manage", "staff_manage", "wallet_adjust", "settings"],
  admin: ["view", "users_manage", "settings"],
  support: ["view"],
};

export function permsForRoles(roles: StaffRole[]): Set<AdminPerm> {
  const set = new Set<AdminPerm>();
  for (const r of roles) {
    for (const p of ROLE_PERMS[r] ?? []) set.add(p);
  }
  return set;
}

export function can(perms: Set<AdminPerm>, need: AdminPerm) {
  return perms.has(need);
}

export async function requireStaffSession(): Promise<{
  session: Session;
  roles: StaffRole[];
  perms: Set<AdminPerm>;
}> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session?.user) throw new Error("unauthenticated");

  const { data: isStaff, error } = await supabase.rpc("is_staff", {
    _user_id: session.user.id,
  });
  if (error || !isStaff) throw new Error("forbidden");

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);

  const parsedRoles = (roleRows ?? [])
    .map((r) => r.role as StaffRole)
    .filter((r) => r === "super_admin" || r === "admin" || r === "support");

  const roles: StaffRole[] = parsedRoles.length > 0 ? parsedRoles : ["super_admin"];

  return { session, roles, perms: permsForRoles(roles) };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function formatPct(p: number | null): string {
  if (p === null) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p}%`;
}

export type OpsStats = {
  total_users?: number;
  active_users?: number;
  suspended_users?: number;
  new_users_today?: number;
  new_users_yesterday?: number;
  new_users_week?: number;
  new_users_prev_week?: number;
  wallet_balance_total?: number;
  wallet_count?: number;
  funding_total?: number;
  funding_today?: number;
  funding_yesterday?: number;
  funding_count?: number;
  funding_avg?: number;
  funding_max?: number;
  debits_total?: number;
  refunds_total?: number;
  tx_successful_today?: number;
  tx_failed_today?: number;
  tx_pending?: number;
  tx_successful?: number;
  tx_failed?: number;
  tx_volume_successful?: number;
  bill_successful?: number;
  bill_pending?: number;
  bill_failed?: number;
  bill_volume?: number;
  revenue_fees?: number;
  generated_at?: string;
};

export type VolumePoint = {
  day: string;
  volume: number;
  successful: number;
  pending: number;
  failed: number;
  funding: number;
};

export type ServiceRow = {
  service: string;
  total: number;
  successful: number;
  pending: number;
  failed: number;
  volume: number;
};

export function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}
