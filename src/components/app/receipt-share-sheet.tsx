import { useState } from "react";
import { FileImage, FileText, Loader2, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import {
  type ReceiptPayload,
  renderReceiptPng,
  renderReceiptPdfFromCanvas,
  shareOrDownload,
} from "@/lib/receipt-share";
import { cn } from "@/lib/utils";

type Props = {
  payload: ReceiptPayload;
  className?: string;
};

export function ReceiptShareButton({ payload, className }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"image" | "pdf" | null>(null);

  const run = async (kind: "image" | "pdf") => {
    setBusy(kind);
    try {
      if (kind === "image") {
        const blob = await renderReceiptPng(payload);
        const result = await shareOrDownload({
          blob,
          filename: `${BRAND.name}-receipt-${payload.reference}.png`,
          title: `${BRAND.name} receipt`,
          text: `${payload.title} · ${payload.amountLabel}`,
        });
        toast.success(result === "shared" ? "Receipt shared" : "Receipt image saved");
      } else {
        const blob = await renderReceiptPdfFromCanvas(payload);
        const result = await shareOrDownload({
          blob,
          filename: `${BRAND.name}-receipt-${payload.reference}.pdf`,
          title: `${BRAND.name} receipt`,
          text: `${payload.title} · ${payload.amountLabel}`,
        });
        toast.success(result === "shared" ? "Receipt shared" : "Receipt PDF saved");
      }
      setOpen(false);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      console.error("[receipt-share]", e);
      toast.error("Could not create receipt. Try again.");
    } finally {
      setBusy(null);
    }
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
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
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
          <div className="relative z-10 w-full max-w-md rounded-t-3xl border bg-card p-5 shadow-xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-extrabold tracking-tight">Share receipt</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Branded {BRAND.name} receipt with logo — image or PDF
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

            <div className="grid gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void run("image")}
                className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3.5 text-left transition hover:bg-muted/50 disabled:opacity-60"
              >
                <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
                  {busy === "image" ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <FileImage className="size-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">Share as image</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Best for WhatsApp, Instagram, and chats
                  </span>
                </span>
              </button>

              <button
                type="button"
                disabled={!!busy}
                onClick={() => void run("pdf")}
                className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3.5 text-left transition hover:bg-muted/50 disabled:opacity-60"
              >
                <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
                  {busy === "pdf" ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <FileText className="size-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">Share as PDF</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Best for email, records, and printing
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
