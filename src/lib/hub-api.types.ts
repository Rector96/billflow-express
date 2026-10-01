/**
 * Hub services — request/response shapes for future backend + aggregator mapping.
 * Used by TIN retrieval and document generator demos.
 * Real calls stay behind TIN_DEMO_MODE / DOC_DEMO_MODE until go-live.
 */

/** POST /api/v1/recover-tin */
export type RecoverTinRequest = {
  /** 11-digit NIN or CAC / BN / RC number */
  identifier: string;
  identifierType: "nin" | "cac";
  fullName: string;
  /** Paystack transaction reference after successful charge */
  paymentReference: string;
  amount: number;
  currency: "NGN";
};

/**
 * Successful recover-tin body (Prembly / Mono-style fields we care about).
 * Backend will normalise the aggregator response into this shape.
 */
export type RecoverTinSuccess = {
  status: "success";
  data: {
    tin: string;
    taxpayerName: string;
    taxpayerType: "individual" | "business";
    jtbRegistered: boolean;
    cacNumber: string | null;
    nin: string | null;
    email: string | null;
    phone: string | null;
    rawProvider?: string;
  };
  meta: {
    paymentReference: string;
    requestId: string;
    fee: number;
  };
};

/** POST /api/v1/generate-document */
export type GenerateDocumentRequest = {
  documentType: "business_constitution" | "residential_tenancy";
  partyA: string;
  partyB: string;
  address: string;
  /** Tenancy only */
  rentAmountYearly?: number;
  duration?: string;
  paymentReference: string;
  amount: number;
  currency: "NGN";
};

export type GenerateDocumentSuccess = {
  status: "success";
  data: {
    documentId: string;
    title: string;
    downloadUrl: string;
    mimeType: string;
    previewText: string;
  };
  meta: {
    paymentReference: string;
    requestId: string;
    fee: number;
  };
};

/** Simulated Paystack inline close payload */
export type PaystackInlineSuccess = {
  reference: string;
  status: "success";
  amount: number;
  currency: "NGN";
};
