/**
 * Client-side Paystack Inline popup.
 * Public key only — verification always happens on the server.
 */

export type PaystackInlineSuccess = {
  reference: string;
  status: "success";
  amount: number;
  currency: "NGN";
};

function publicKey(): string {
  const key =
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.["VITE_PAYSTACK_PUBLIC_KEY"] as string | undefined)) ||
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.["NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY"] as string | undefined)) ||
    "";
  return String(key).trim();
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Paystack is only available in the browser."));
      return;
    }
    const w = window as Window & {
      PaystackPop?: { setup: (opts: unknown) => { openIframe: () => void } };
    };
    if (w.PaystackPop) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-paystack="inline"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Paystack.")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.dataset.paystack = "inline";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Paystack script."));
    document.body.appendChild(s);
  });
}

/**
 * Opens Paystack Inline. Resolves only after successful charge callback.
 * Rejects if user closes the modal or script fails.
 */
export async function openPaystackInline(input: {
  email: string;
  amountNaira: number;
  metadata?: Record<string, string>;
  reference?: string;
}): Promise<PaystackInlineSuccess> {
  const key = publicKey();
  if (!key) {
    throw new Error(
      "Paystack public key missing. Set VITE_PAYSTACK_PUBLIC_KEY (test or live) in Netlify.",
    );
  }
  await loadPaystackScript();
  const amountKobo = Math.round(input.amountNaira * 100);
  const reference = input.reference || `PSK_${Date.now()}${Math.floor(Math.random() * 1e5)}`;

  return new Promise((resolve, reject) => {
    const w = window as Window & {
      PaystackPop?: {
        setup: (opts: Record<string, unknown>) => { openIframe: () => void };
      };
    };
    if (!w.PaystackPop) {
      reject(new Error("Paystack failed to initialize."));
      return;
    }
    const handler = w.PaystackPop.setup({
      key,
      email: input.email,
      amount: amountKobo,
      currency: "NGN",
      ref: reference,
      metadata: {
        custom_fields: Object.entries(input.metadata ?? {}).map(([k, v]) => ({
          display_name: k,
          variable_name: k,
          value: v,
        })),
      },
      callback: (response: { reference?: string }) => {
        const ref = String(response?.reference ?? reference);
        resolve({
          reference: ref,
          status: "success",
          amount: amountKobo,
          currency: "NGN",
        });
      },
      onClose: () => {
        reject(new Error("Payment window closed before completion."));
      },
    });
    handler.openIframe();
  });
}
