/**
 * Client-side receipt export — elegant RockPay branded card (image + PDF).
 * Presentation only; no money logic.
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
  /** Optional extra rows e.g. Data Plan */
  detailRows?: { label: string; value: string }[] | null;
};

export function statusLabel(status: string): string {
  if (status === "successful") return "Success";
  if (status === "pending") return "Pending";
  if (status === "failed") return "Failed";
  return status || "Unknown";
}

export function statusColor(status: string): string {
  if (status === "successful") return "#10B981";
  if (status === "pending") return "#F59E0B";
  if (status === "failed") return "#EF4444";
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

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

/** Elegant receipt matching RockPay marketing mockups. */
export async function renderReceiptPng(payload: ReceiptPayload): Promise<Blob> {
  const width = 680;
  const cardX = 24;
  const cardW = width - 48;
  const pad = 36;
  const innerX = cardX + pad;
  const innerW = cardW - pad * 2;

  const rows: { label: string; value: string }[] = [];
  rows.push({ label: "Transaction", value: payload.title || "Payment" });
  if (payload.network) rows.push({ label: "Provider", value: payload.network });
  if (payload.service && payload.service !== payload.title) {
    rows.push({ label: "Service", value: payload.service });
  }
  if (payload.recipient) rows.push({ label: "Recipient", value: payload.recipient });
  if (payload.detailRows) {
    for (const r of payload.detailRows) rows.push(r);
  }
  if (payload.dateLabel) rows.push({ label: "Date", value: payload.dateLabel });
  rows.push({ label: "Transaction ID", value: payload.reference });
  if (payload.providerRef) rows.push({ label: "Provider ref", value: payload.providerRef });
  if (payload.channel) rows.push({ label: "Channel", value: payload.channel });
  if (payload.method) rows.push({ label: "Payment method", value: payload.method });
  if (payload.tokenLabel && payload.tokenValue) {
    rows.push({ label: payload.tokenLabel, value: payload.tokenValue });
  }

  const headerBlock = 210;
  const heroH = 72;
  const rowH = 44;
  const footerH = 70;
  const height = 40 + headerBlock + heroH + 24 + rows.length * rowH + footerH + 40;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Soft blue-lavender page (like mockup)
  ctx.fillStyle = "#DCEBFA";
  ctx.fillRect(0, 0, width, height);

  // White card + soft shadow
  ctx.save();
  ctx.shadowColor = "rgba(30, 27, 75, 0.12)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, cardX, 28, cardW, height - 56, 28);
  ctx.fill();
  ctx.restore();

  let y = 56;

  // Brand mark + wordmark
  let drewLogo = false;
  try {
    const logo = await loadImage(BRAND.markUrl || BRAND.logoUrl);
    const markH = 40;
    const markW = (logo.width / logo.height) * markH;
    ctx.drawImage(logo, (width - markW) / 2, y, markW, markH);
    y += markH + 8;
    drewLogo = true;
  } catch {
    /* fall through */
  }
  if (!drewLogo) {
    // Drawn "R" mark
    ctx.fillStyle = "#7C3AED";
    roundRect(ctx, width / 2 - 22, y, 44, 44, 12);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 22px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("R", width / 2, y + 30);
    y += 52;
  }

  ctx.fillStyle = "#5B21B6";
  ctx.font = "700 18px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(BRAND.name, width / 2, y + 4);
  y += 36;

  // Success / status pill with check
  const st = statusLabel(payload.status);
  const stColor = statusColor(payload.status);
  ctx.font = "600 13px system-ui, sans-serif";
  const stTextW = ctx.measureText(st).width;
  const stW = stTextW + 40;
  const stX = (width - stW) / 2;
  ctx.fillStyle = `${stColor}18`;
  roundRect(ctx, stX, y, stW, 28, 14);
  ctx.fill();
  // simple check circle
  ctx.beginPath();
  ctx.arc(stX + 14, y + 14, 8, 0, Math.PI * 2);
  ctx.fillStyle = stColor;
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(stX + 10, y + 14);
  ctx.lineTo(stX + 13, y + 17);
  ctx.lineTo(stX + 19, y + 11);
  ctx.stroke();
  ctx.fillStyle = stColor;
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(st, stX + 28, y + 18);
  y += 48;

  // Large amount
  ctx.fillStyle = "#0F172A";
  ctx.font = "800 42px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  const amountText = payload.amountLabel.replace(/^\+/, "");
  ctx.fillText(amountText, width / 2, y);
  y += 28;

  // Gradient hero card for transaction type
  const heroY = y;
  const grad = ctx.createLinearGradient(innerX, heroY, innerX + innerW, heroY + heroH);
  grad.addColorStop(0, "#EDE9FE");
  grad.addColorStop(0.5, "#F5F3FF");
  grad.addColorStop(1, "#DBEAFE");
  ctx.fillStyle = grad;
  roundRect(ctx, innerX, heroY, innerW, heroH, 18);
  ctx.fill();
  ctx.fillStyle = "#6D28D9";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Transaction", innerX + 18, heroY + 28);
  ctx.fillStyle = "#1E1B4B";
  ctx.font = "800 17px system-ui, sans-serif";
  ctx.fillText(truncate(ctx, payload.title || "Payment", innerW - 36), innerX + 18, heroY + 52);
  y = heroY + heroH + 20;

  // Detail rows
  for (const row of rows) {
    if (row.label === "Transaction") continue; // already in hero
    ctx.fillStyle = "#94A3B8";
    ctx.font = "500 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(row.label, innerX, y + 8);
    ctx.fillStyle = "#0F172A";
    ctx.font = "700 13px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "right";
    ctx.fillText(truncate(ctx, row.value, innerW * 0.55), innerX + innerW, y + 8);
    // hairline
    ctx.strokeStyle = "rgba(15, 23, 42, 0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX, y + 22);
    ctx.lineTo(innerX + innerW, y + 22);
    ctx.stroke();
    y += rowH;
  }

  y += 8;
  ctx.fillStyle = "#94A3B8";
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(BRAND.supportEmail, width / 2, y);
  y += 18;
  ctx.fillStyle = "#CBD5E1";
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.fillText(`Powered by ${BRAND.name}`, width / 2, y);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create image"))),
      "image/png",
      1,
    );
  });
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    // revoke after paint in caller if needed — loadImage already resolved
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** PDF via canvas → JPEG embed (no npm deps). */
export async function renderReceiptPdfFromCanvas(payload: ReceiptPayload): Promise<Blob> {
  const pngBlob = await renderReceiptPng(payload);
  const img = await blobToImage(pngBlob);
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
      0.93,
    );
  });
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  const pageW = 400;
  const scale = pageW / canvas.width;
  const pageH = Math.round(canvas.height * scale);
  const pdf = buildPdfWithJpeg(bytes, pageW, pageH, canvas.width, canvas.height);
  return new Blob([pdf], { type: "application/pdf" });
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

  if (
    typeof navigator !== "undefined" &&
    navigator.share &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: opts.title,
        text: opts.text ?? opts.title,
      });
      return "shared";
    } catch (e) {
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
