/**
 * Demo-only helpers: Paystack Pop simulation + mock aggregator responses.
 * Replace with real Paystack inline + server functions when go-live.
 */
import type {
  GenerateDocumentRequest,
  GenerateDocumentSuccess,
  PaystackInlineSuccess,
  RecoverTinRequest,
  RecoverTinSuccess,
} from "@/lib/hub-api.types";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Simulates Paystack Pop inline checkout.
 * In production: load Paystack script, call PaystackPop.setup({ key, email, amount, ref, callback }).
 */
export async function simulatePaystackInline(input: {
  email: string;
  amountNaira: number;
  metadata?: Record<string, string>;
}): Promise<PaystackInlineSuccess> {
  await new Promise((r) => setTimeout(r, 1100));
  const reference = `PSK_${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  if (import.meta.env.DEV) {
    console.info("[Paystack demo]", { ...input, reference });
  }
  return {
    reference,
    status: "success",
    amount: Math.round(input.amountNaira * 100),
    currency: "NGN",
  };
}

function guessIdentifierType(raw: string): "nin" | "cac" {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return "nin";
  return "cac";
}

/** Builds the body we will POST to /api/v1/recover-tin after Paystack success. */
export function buildRecoverTinPayload(input: {
  identifier: string;
  fullName: string;
  paymentReference: string;
  fee: number;
}): RecoverTinRequest {
  return {
    identifier: input.identifier.replace(/\s/g, "").trim(),
    identifierType: guessIdentifierType(input.identifier),
    fullName: input.fullName.trim(),
    paymentReference: input.paymentReference,
    amount: input.fee,
    currency: "NGN",
  };
}

/**
 * Demo: pretend POST /api/v1/recover-tin and return Prembly/Mono-like success JSON.
 * Production: fetch('/api/v1/recover-tin', { method: 'POST', body: JSON.stringify(payload) })
 */
export async function postRecoverTinDemo(payload: RecoverTinRequest): Promise<RecoverTinSuccess> {
  await new Promise((r) => setTimeout(r, 700));
  const digits = payload.identifier.replace(/\D/g, "").padEnd(11, "0").slice(0, 11);
  const tin = `${digits.slice(0, 8)}-${String((Number(digits.slice(-3)) % 9000) + 1000)}`;

  const mock: RecoverTinSuccess = {
    status: "success",
    data: {
      tin,
      taxpayerName: payload.fullName.toUpperCase(),
      taxpayerType: payload.identifierType === "cac" ? "business" : "individual",
      jtbRegistered: true,
      cacNumber: payload.identifierType === "cac" ? payload.identifier : null,
      nin: payload.identifierType === "nin" ? payload.identifier : null,
      email: null,
      phone: null,
      rawProvider: "prembly_demo",
    },
    meta: {
      paymentReference: payload.paymentReference,
      requestId: uid("tin"),
      fee: payload.amount,
    },
  };

  if (import.meta.env.DEV) {
    console.info("[POST /api/v1/recover-tin] request", payload);
    console.info("[POST /api/v1/recover-tin] response", mock);
  }
  return mock;
}

export function buildGenerateDocumentPayload(input: {
  documentType: GenerateDocumentRequest["documentType"];
  partyA: string;
  partyB: string;
  address: string;
  rent?: string;
  duration?: string;
  paymentReference: string;
  fee: number;
}): GenerateDocumentRequest {
  return {
    documentType: input.documentType,
    partyA: input.partyA.trim(),
    partyB: input.partyB.trim(),
    address: input.address.trim(),
    rentAmountYearly: input.rent ? Number(input.rent.replace(/,/g, "")) : undefined,
    duration: input.duration?.trim() || undefined,
    paymentReference: input.paymentReference,
    amount: input.fee,
    currency: "NGN",
  };
}

export async function postGenerateDocumentDemo(
  payload: GenerateDocumentRequest,
  previewText: string,
): Promise<GenerateDocumentSuccess> {
  await new Promise((r) => setTimeout(r, 700));
  const documentId = uid("doc");
  const mock: GenerateDocumentSuccess = {
    status: "success",
    data: {
      documentId,
      title:
        payload.documentType === "business_constitution"
          ? "Business Constitution"
          : "Residential Tenancy Agreement",
      downloadUrl: `https://api.rockpay.local/v1/documents/${documentId}/download`,
      mimeType: "text/plain",
      previewText,
    },
    meta: {
      paymentReference: payload.paymentReference,
      requestId: uid("docreq"),
      fee: payload.amount,
    },
  };
  if (import.meta.env.DEV) {
    console.info("[POST /api/v1/generate-document] request", payload);
    console.info("[POST /api/v1/generate-document] response", mock);
  }
  return mock;
}
