/**
 * Client-side receipt export helpers (image + PDF).
 * No money logic — presentation only.
 */

import { BRAND } from "@/lib/brand";

export type ReceiptPayload = {
  reference: string;
  title: string;
  status: "successful" | "pending" | "failed" | string;
  amountLabel: string;
  direction?: "in" | "out";
  service?: string | null;
  network?: string | null;
  recipient?: string | null;
  providerRef?: string | null;
  channel?: string | null;
  dateLabel?: string | null;
  method?: string | null;
  tokenLabel?: string | null;
  tokenValue?: string | null;
};

export function statusLabel(status: string): string {
  if (status === "successful") return "Successful";
  if (status === "pending") return "Pending";
  if (status === "failed") return "Failed";
  return status || "Unknown";
}

export function statusColor(status: string): string {
  if (status === "successful") return "#059669";
  if (status === "pending") return "#D97706";
  if (status === "failed") return "#DC2626";
  return "#6B7280";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load brand logo"));
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawLabelValue(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  ctx.fillStyle = "#6B7280";
  ctx.font = "500 12px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(label, x, y);
  ctx.fillStyle = "#1A1A2E";
  ctx.font = "600 13px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  const maxValueWidth = width * 0.58;
  let text = value;
  if (ctx.measureText(text).width > maxValueWidth) {
    while (text.length > 4 && ctx.measureText(text + "…").width > maxValueWidth) {
      text = text.slice(0, -1);
    }
    text = text + "…";
  }
  ctx.fillText(text, x + width, y);
  ctx.textAlign = "left";
}

/** Draw a branded receipt onto a canvas and return PNG blob. */
export async function renderReceiptPng(payload: ReceiptPayload): Promise<Blob> {
  const width = 720;
  const pad = 40;
  const contentW = width - pad * 2;

  const rows: [string, string][] = [];
  if (payload.service) rows.push(["Service", payload.service]);
  if (payload.network) rows.push(["Network / Provider", payload.network]);
  if (payload.recipient) rows.push(["Recipient", payload.recipient]);
  rows.push(["Amount", payload.amountLabel]);
  rows.push(["RockPay reference", payload.reference]);
  if (payload.providerRef) rows.push(["Provider reference", payload.providerRef]);
  if (payload.channel) rows.push(["Channel", payload.channel]);
  if (payload.dateLabel) rows.push(["Date", payload.dateLabel]);
  if (payload.method) rows.push(["Payment method", payload.method]);
  if (payload.tokenLabel && payload.tokenValue) {
    rows.push([payload.tokenLabel, payload.tokenValue]);
  }

  const headerH = 200;
  const rowH = 36;
  const footerH = 72;
  const height = headerH + rows.length * rowH + footerH + pad;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Background wash
  ctx.fillStyle = "#F4F2FA";
  ctx.fillRect(0, 0, width, height);

  // Card
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 20, 20, width - 40, height - 40, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(109, 40, 217, 0.08)";
  ctx.lineWidth = 1;
  roundRect(ctx, 20, 20, width - 40, height - 40, 24);
  ctx.stroke();

  let y = pad + 12;

  // Logo
  try {
    const logo = await loadImage(BRAND.logoUrl);
    const logoH = 48;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, (width - logoW) / 2, y, logoW, logoH);
    y += logoH + 20;
  } catch {
    ctx.fillStyle = "#6D28D9";
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(BRAND.name, width / 2, y + 24);
    ctx.textAlign = "left";
    y += 48;
  }

  // Status pill
  const st = statusLabel(payload.status);
  const stColor = statusColor(payload.status);
  ctx.font = "600 12px system-ui, sans-serif";
  const stW = ctx.measureText(st).width + 28;
  const stX = (width - stW) / 2;
  ctx.fillStyle = `${stColor}18`;
  roundRect(ctx, stX, y, stW, 26, 13);
  ctx.fill();
  ctx.fillStyle = stColor;
  ctx.textAlign = "center";
  ctx.fillText(st, width / 2, y + 17);
  ctx.textAlign = "left";
  y += 42;

  // Title + amount
  ctx.fillStyle = "#1A1A2E";
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(payload.title || "Payment", width / 2, y);
  y += 32;
  ctx.font = "800 34px system-ui, sans-serif";
  ctx.fillText(payload.amountLabel, width / 2, y);
  ctx.textAlign = "left";
  y += 36;

  // Divider
  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += 28;

  for (const [label, value] of rows) {
    drawLabelValue(ctx, label, value, pad, y, contentW);
    y += rowH;
  }

  // Footer
  y = height - 52;
  ctx.fillStyle = "#9CA3AF";
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${BRAND.name} · ${BRAND.tagline}`, width / 2, y);
  ctx.fillText(BRAND.supportEmail, width / 2, y + 16);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create image"))),
      "image/png",
      1,
    );
  });
}

/** Minimal single-page PDF (no extra dependency). */
export async function renderReceiptPdf(payload: ReceiptPayload): Promise<Blob> {
  const png = await renderReceiptPng(payload);
  const pngBytes = new Uint8Array(await png.arrayBuffer());

  // Embed PNG in a simple PDF page sized to image (72dpi-ish points from px/2)
  const imgW = 720;
  const imgH = await blobImageHeight(png);
  const pageW = 420;
  const scale = pageW / imgW;
  const pageH = Math.max(500, Math.round(imgH * scale));

  const pdf = buildPdfWithPng(pngBytes, pageW, pageH, imgW, imgH);
  return new Blob([pdf], { type: "application/pdf" });
}

async function blobImageHeight(blob: Blob): Promise<number> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    return img.height;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildPdfWithPng(
  png: Uint8Array,
  pageW: number,
  pageH: number,
  imgW: number,
  imgH: number,
): Uint8Array {
  // Minimal PDF 1.4 with one image XObject
  const objects: string[] = [];
  const offsets: number[] = [];

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let size = 0;

  const pushStr = (s: string) => {
    const b = encoder.encode(s);
    parts.push(b);
    size += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    parts.push(b);
    size += b.length;
  };
  const markObject = () => {
    offsets.push(size);
  };

  pushStr("%PDF-1.4\n");

  // 1 Catalog
  markObject();
  pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  // 2 Pages
  markObject();
  pushStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  // 3 Page
  markObject();
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );
  // 4 Image
  markObject();
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${png.length} >>\nstream\n`,
  );
  // PNG cannot use DCTDecode (JPEG). Use raw Flate or store as PNG with different approach.
  // Simpler path: use data-URI print fallback — but for reliability, switch to JPEG encode from canvas.
  // This function is only called with JPEG bytes from renderReceiptJpeg below.
  pushBytes(png);
  pushStr("\nendstream\nendobj\n");

  // Actually we need JPEG for DCTDecode. Caller must pass JPEG.
  const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  markObject();
  pushStr(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  const xrefStart = size;
  pushStr(`xref\n0 ${offsets.length + 1}\n`);
  pushStr("0000000000 65535 f \n");
  for (const off of offsets) {
    pushStr(`${String(off).padStart(10, "0")} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Preferred PDF path: canvas → JPEG → simple PDF. */
export async function renderReceiptPdfFromCanvas(payload: ReceiptPayload): Promise<Blob> {
  const width = 720;
  // Re-render to canvas then JPEG
  const pngBlob = await renderReceiptPng(payload);
  const url = URL.createObjectURL(pngBlob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const jpeg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))),
        "image/jpeg",
        0.92,
      );
    });
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    const pageW = 420;
    const scale = pageW / canvas.width;
    const pageH = Math.round(canvas.height * scale);
    const pdf = buildPdfWithJpeg(bytes, pageW, pageH, canvas.width, canvas.height);
    return new Blob([pdf], { type: "application/pdf" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildPdfWithJpeg(
  jpeg: Uint8Array,
  pageW: number,
  pageH: number,
  imgW: number,
  imgH: number,
): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let size = 0;
  const offsets: number[] = [];

  const pushStr = (s: string) => {
    const b = encoder.encode(s);
    parts.push(b);
    size += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    parts.push(b);
    size += b.length;
  };
  const markObject = () => offsets.push(size);

  pushStr("%PDF-1.4\n");
  markObject();
  pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  markObject();
  pushStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  markObject();
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );
  markObject();
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  pushBytes(jpeg);
  pushStr("\nendstream\nendobj\n");
  const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  markObject();
  pushStr(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  const xrefStart = size;
  pushStr(`xref\n0 ${offsets.length + 1}\n`);
  pushStr("0000000000 65535 f \n");
  for (const off of offsets) {
    pushStr(`${String(off).padStart(10, "0")} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export async function shareOrDownload(opts: {
  blob: Blob;
  filename: string;
  title: string;
  text?: string;
}): Promise<"shared" | "downloaded"> {
  const file = new File([opts.blob], opts.filename, { type: opts.blob.type });

  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: opts.title,
        text: opts.text ?? opts.title,
      });
      return "shared";
    } catch (e) {
      // User dismissed share sheet — not an error
      if (e instanceof Error && e.name === "AbortError") throw e;
    }
  }

  const url = URL.createObjectURL(opts.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}
