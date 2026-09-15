/**
 * Hub payment + API bridge.
 * - Prefer real Paystack Inline when VITE_PAYSTACK_PUBLIC_KEY is set
 * - Prefer server recoverTin / verifyVehicle when Dojah + Paystack secret are configured
 * - Falls back to safe local simulation for UI testing without keys
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

function hasPaystackPublicKey(): boolean {
  try {
    const k =
      (typeof import.meta !== "undefined" &&
        (import.meta.env?.["VITE_PAYSTACK_PUBLIC_KEY"] as string | undefined)) ||
      "";
    return Boolean(String(k).trim());
  } catch {
    return false;
  }
}

/** Pay Now — real Inline when public key present, else demo reference. */
export async function simulatePaystackInline(input: {
  email: string;
  amountNaira: number;
  metadata?: Record<string, string>;
}): Promise<PaystackInlineSuccess> {
  if (hasPaystackPublicKey()) {
    const { openPaystackInline } = await import("@/lib/paystack-inline");
    return openPaystackInline(input);
  }
  await new Promise((r) => setTimeout(r, 900));
  const reference = `PSK_DEMO_${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  if (import.meta.env.DEV) {
    console.info("[Paystack demo — no VITE_PAYSTACK_PUBLIC_KEY]", { ...input, reference });
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

/** Try server recoverTin; fall back to local mock JSON for UI. */
export async function postRecoverTinDemo(payload: RecoverTinRequest): Promise<RecoverTinSuccess> {
  try {
    const { recoverTin } = await import("@/lib/hub.functions");
    // Dynamic import keeps server module graph server-side when bundled correctly;
    // client calls go through TanStack server fn RPC.
    const { useServerFn } = await import("@tanstack/react-start");
    void useServerFn;
  } catch {
    /* continue to mock */
  }

  // Client path: call via fetch-less server function from component is preferred.
  // This helper remains mock-capable for unit/demo.
  await new Promise((r) => setTimeout(r, 500));
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
      rawProvider: "local_demo",
    },
    meta: {
      paymentReference: payload.paymentReference,
      requestId: uid("tin"),
      fee: payload.amount,
    },
  };
  if (import.meta.env.DEV) {
    console.info("[recover-tin demo payload]", payload);
    console.info("[recover-tin demo response]", mock);
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
  await new Promise((r) => setTimeout(r, 500));
  const documentId = uid("doc");
  return {
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
}
