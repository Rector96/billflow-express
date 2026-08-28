import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VtpassMode = "sandbox" | "live";

export type VtpassPayResult = {
  code: string;
  responseDescription: string;
  requestId: string;
  transactionId: string | null;
  contentStatus: string | null;
  purchasedCode: string | null;
  /** VTpass content.transactions.total_amount when present (what provider charged). */
  totalAmount: number | null;
  /** VTpass content.transactions.commission when present. */
  commission: number | null;
  raw: unknown;
};

/** Parse a numeric money field from VTpass payloads (null if absent/invalid). */
export function parseVtpassMoney(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(n)) return Math.round(n * 100) / 100;
  }
  return null;
}
