import { useState } from "react";
import { Download, FileImage, FileText, Loader2, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import {
  type ReceiptPayload,
  renderReceiptPng,
  renderReceiptPdfFromCanvas,
  shareOrDownload,
  downloadReceiptBlob,
} from "@/lib/receipt-share";
import { renderFallbackReceiptPdf, renderFallbackReceiptPng } from "@/lib/receipt-fallback";
import { cn } from "@/lib/utils";

type Props = {
  payload: ReceiptPayload;
  className?: string;
};

type ReceiptKind = "image" | "pdf";
type Action = "share" | "download";

export function ReceiptShareButton({ payload, className }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const createReceipt = async (kind: ReceiptKind): Promise<Blob> => {
    if (kind === "image") {
      try {
        return await renderReceiptPng(payload);
      } catch (error) {
        console.warn("[receipt-share] Primary image renderer failed; using fallback", error);
        return await renderFallbackReceiptPng(payload);
      }
    }

    try {
      return await renderReceiptPdfFromCanvas(payload);
    } catch (error) {
      console.warn("[receipt-share] Primary PDF renderer failed; using fallback", error);
      return await renderFallbackReceiptPdf(payload);
    }
  };

  const run = async (kind: ReceiptKind, action: Action) => {
    const key = `${action}-${kind}`;
    setBusy(key);

    try {
      const blob = await createReceipt(kind);
      const filename = `${BRAND.name}-receipt-${payload.reference}.${kind === "image" ? "png" : "pdf"}`;
      const text = [
        payload.title,
        payload.amountLabel,
        `RockPay reference: ${payload.reference}`,
        payload.paystackRef ? `Paystack reference: ${payload.paystackRef}` : null,
        payload.providerRef ? `Provider reference: ${payload.providerRef}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      if (action === "download") {
        downloadReceiptBlob(blob, filename);
        toast.success(kind === "image" ? "Receipt image downloaded" : "Receipt PDF downloaded");
        setOpen(false);
        return;
      }

      const result = await shareOrDownload({
        blob,
        filename,
        title: `${BRAND.name} receipt`,
        text,
      });

      if (result === "unsupported") {
        toast.error("Sharing files isn't supported in this browser. Choose Download instead.");
        return;
      }

      toast.success("Receipt shared");
      setOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("[receipt-share]", error);
      toast.error("We couldn't process the receipt. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const option = (
    kind: ReceiptKind,
    action: Action,
    label: string,
    description: string,
    Icon: typeof FileImage,
  ) => {
    const key = `${action}-${kind}`;

    return (
      <button
        type="button"
        disabled={!!busy}
        onClick={() => void run(kind, action)}
        className="flex min-h-16 items-center gap-3 rounded-2xl border bg-background px-4 py-3.5 text-left transition hover:bg-muted/50 disabled:opacity-60"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          {busy === key ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{label}</span>
          <span className="block text-[11px] text-muted-foreground">{description}</span>
        </span>
      </button>
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn("h-12 w-full rounded-2xl font-bold", className)}
        onClick={() => setOpen(true)}
      >
        <Share2 className="size-4" />
        Share receipt
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center px-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-4 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Share receipt"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => !busy && setOpen(false)}
          />

          <div className="relative z-10 max-h-[calc(100dvh-7rem)] w-full max-w-md overflow-y-auto rounded-3xl border bg-card p-5 shadow-xl sm:max-h-none">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-extrabold tracking-tight">Receipt options</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Share your {BRAND.name} receipt or download a copy.
                </p>
              </div>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setOpen(false)}
                className="grid size-9 place-items-center rounded-full border text-muted-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Share
            </p>
            <div className="grid gap-2">
              {option(
                "image",
                "share",
                "Share as image",
                "Send through WhatsApp and other available apps",
                Share2,
              )}
              {option(
                "pdf",
                "share",
                "Share as PDF",
                "Send a PDF through available sharing apps",
                Share2,
              )}
            </div>

            <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Download
            </p>
            <div className="grid gap-2">
              {option(
                "image",
                "download",
                "Download image",
                "Save the receipt as a PNG image",
                FileImage,
              )}
              {option(
                "pdf",
                "download",
                "Download PDF",
                "Save the receipt as a PDF document",
                FileText,
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
