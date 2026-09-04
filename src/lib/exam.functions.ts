import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mapVtpassOutcome, type VtpassPayResult } from "./vtpass.server";

const EXAM_IDS = new Set(["waec", "neco", "nabteb", "jamb"]);

export type ExamVariation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

export type ExamPurchaseResult = {
  status: "successful" | "pending" | "failed";
  reference: string;
  pins: string[];
  amount: number;
  message: string;
  requestId: string;
  providerTransactionId: string | null;
};

function examId(input: unknown): string {
  const value = String(input ?? "").trim().toLowerCase();
  if (!EXAM_IDS.has(value)) throw new Error("Select a valid exam body.");
  return value;
}

function safePayload(raw: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stringsFromCards(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((card) => {
    if (typeof card === "string" && card.trim()) return [card.trim()];
    if (!card || typeof card !== "object") return [];
    const row = card as Record<string, unknown>;
    for (const key of ["purchased_code", "pin", "token", "code", "serial"]) {
      if (typeof row[key] === "string" && row[key].trim()) return [row[key].trim()];
    }
    return [];
  });
}

function extractPins(result: VtpassPayResult): string[] {
  const raw = result.raw as Record<string, unknown>;
  const content = (raw["content"] ?? {}) as Record<string, unknown>;
  const transactions = (content["transactions"] ?? {}) as Record<string, unknown>;
  const cards =
    raw["cards"] ?? content["cards"] ?? transactions["cards"] ?? content["card"] ?? transactions["card"];
  const pins = stringsFromCards(cards);
  if (pins.length) return pins;
  return result.purchasedCode ? [result.purchasedCode] : [];
}

function providerMessage(status: ExamPurchaseResult["status"], exam: string, amount: number, detail: string): string {
  if (status === "successful") {
    return `Your ${exam.toUpperCase()} PIN purchase of ₦${Math.round(amount).toLocaleString("en-NG")} was successful.`;
  }
  if (status === "failed") {
    return detail ? `Your ${exam.toUpperCase()} PIN purchase failed (${detail}). Your wallet has been refunded.` : `Your ${exam.toUpperCase()} PIN purchase failed. Your wallet has been refunded.`;
  }
  return `Your ${exam.toUpperCase()} PIN purchase is still being confirmed.`;
}

export const listExamCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examId: string }) => ({ examId: examId(input?.examId) }))
  .handler(async ({ data }) => {
    const { getVtpassConfig, vtpassListVariations } = await import("./vtpass.server");
    getVtpassConfig();
    const variations = await vtpassListVariations(data.examId);
    return variations.filter((variation) => variation.amount > 0);
  });

export const purchaseExamPins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examId: string; variationCode: string; quantity: number; pin: string; profileId?: string }) => {
    const exam = examId(input?.examId);
    const variationCode = String(input?.variationCode ?? "").trim();
    const quantity = Math.round(Number(input?.quantity));
    const pin = String(input?.pin ?? "");
    const profileId = String(input?.profileId ?? "").trim();
    if (!variationCode || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error("Select a valid PIN quantity.");
    if (!/^\d{4}$/.test(pin)) throw new Error("Enter your 4-digit PIN.");
    if (exam === "jamb" && !profileId) throw new Error("Enter your JAMB Profile ID.");
    return { exam, variationCode, quantity, pin, profileId };
  })
  .handler(async ({ data, context }): Promise<ExamPurchaseResult> => {
    const { getVtpassConfig, vtpassListVariations, vtpassPay, normalizeNgPhone } = await import("./vtpass.server");
    getVtpassConfig();
    const variation = (await vtpassListVariations(data.exam)).find((item) => item.variationCode === data.variationCode);
    if (!variation || variation.amount <= 0) throw new Error("Selected exam PIN is no longer available.");
    const unitAmount = Math.round(variation.amount * 100) / 100;
    const totalAmount = Math.round(unitAmount * data.quantity * 100) / 100;
    const { data: profile } = await context.supabase.from("profiles").select("phone").eq("user_id", context.userId).maybeSingle();
    let phone = "08011111111";
    if (profile?.phone) {
      try { phone = normalizeNgPhone(profile.phone); } catch { /* provider fallback */ }
    }
    const requestId = `exam-${crypto.randomUUID()}`;
    const identifier = data.exam === "jamb" ? data.profileId : data.exam;
    const { data: started, error } = await context.supabase.rpc("start_bill_purchase", {
      _service_slug: "exam-pins",
      _service_label: "Exam PIN",
      _provider: data.exam,
      _product: variation.name,
      _customer_identifier: identifier,
      _amount: totalAmount,
      _pin: data.pin,
      _metadata: { title: "Exam PIN", service_slug: "exam-pins", variation_code: data.variationCode, quantity: data.quantity, unit_amount: unitAmount },
      _request_id: requestId,
    });
    if (error) throw new Error(error.message.includes("insufficient_funds") ? "insufficient_funds" : error.message);
    const row = Array.isArray(started) ? started[0] : started;
    if (!row?.internal_reference || !row?.request_id) throw new Error("Could not start exam PIN purchase.");
    const pay = await vtpassPay({
      request_id: row.request_id,
      serviceID: data.exam,
      variation_code: data.variationCode,
      amount: unitAmount,
      quantity: data.quantity,
      phone,
      ...(data.exam === "jamb" ? { billersCode: data.profileId } : {}),
    });
    const outcome = mapVtpassOutcome(pay);
    const pins = outcome === "successful" ? extractPins(pay) : [];
    const payload = {
      vtpass_code: pay.code,
      vtpass_status: pay.contentStatus,
      response_description: pay.responseDescription,
      purchased_code: pay.purchasedCode,
      token: pins.join("\n") || pay.purchasedCode,
      pins,
      quantity: data.quantity,
      vtpass_snapshot: safePayload(pay.raw),
    };
    const { data: finalized, error: settleError } = await supabaseAdmin.rpc("trusted_complete_bill_purchase", {
      _user_id: context.userId,
      _internal_reference: row.internal_reference,
      _outcome: outcome,
      _provider_transaction_id: pay.transactionId ?? "",
      _payload: payload,
    });
    if (settleError) throw new Error(settleError.message);
    const fin = Array.isArray(finalized) ? finalized[0] : finalized;
    const status = (fin?.status ?? outcome) as ExamPurchaseResult["status"];
    return {
      status,
      reference: String(fin?.internal_reference ?? row.internal_reference),
      pins: status === "successful" ? pins : [],
      amount: totalAmount,
      message: providerMessage(status, data.exam, totalAmount, pay.responseDescription),
      requestId: row.request_id,
      providerTransactionId: pay.transactionId,
    };
  });
