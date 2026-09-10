/**
 * Client-side receipt export — polished RockPay receipt (image + PDF).
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
  detailRows?: { label: string; value: string }[] | null;
};

export function statusLabel(status: string): string {
  if (status === "successful") return "Successful";
  if (status === "pending") return "Pending";
  if (status === "failed") return "Failed";
  return status || "Unknown";
}

export function statusColor(status: string): string {
  if (status === "successful") return "#10B981";
  if (status === "pending") return "#F59E0B";
  if (status === "failed") return "#EF4444";
  return "#64748B";
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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const value = String(text || "—");
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }

    let part = "";
    for (const char of word) {
      const candidatePart = part + char;
      if (ctx.measureText(candidatePart).width > maxWidth && part) {
        lines.push(part);
        part = char;
      } else {
        part = candidatePart;
      }
    }
    line = part;
  }

  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
}

function drawCenteredText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

function drawPerforation(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.save();
  ctx.fillStyle = "#F8FAFC";
  const radius = 4;
  const gap = 14;
  for (let px = x + 10; px < x + w - 10; px += gap) {
    ctx.beginPath();
    ctx.arc(px, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStatusIcon(ctx: CanvasRenderingContext2D, status: string, x: number, y: number) {
  const color = statusColor(status);
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  ctx.fillStyle = `${color}18`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 19px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(status === "successful" ? "✓" : status === "pending" ? "…" : "!", x, y + 7);
  ctx.textAlign = "left";
}

/** Render a premium, spacious RockPay receipt suitable for WhatsApp and PDF. */
export async function renderReceiptPng(payload: ReceiptPayload): Promise<Blob> {
  const width = 720;
  const cardX = 32;
  const cardW = width - cardX * 2;
  const pad = 46;
  const innerX = cardX + pad;
  const innerW = cardW - pad * 2;
  const status = String(payload.status || "unknown");

  const rows: { label: string; value: string }[] = [];
  if (payload.network) rows.push({ label: "Provider", value: payload.network });
  if (payload.service && payload.service !== payload.title) {
    rows.push({ label: "Service", value: payload.service });
  }
  if (payload.recipient) rows.push({ label: "Recipient", value: payload.recipient });
  if (payload.detailRows) rows.push(...payload.detailRows);
  if (payload.dateLabel) rows.push({ label: "Date & time", value: payload.dateLabel });
  rows.push({ label: "Transaction ID", value: payload.reference });
  if (payload.providerRef) rows.push({ label: "Provider reference", value: payload.providerRef });
  if (payload.channel) rows.push({ label: "Channel", value: payload.channel });
  if (payload.method) rows.push({ label: "Payment method", value: payload.method });

  const normalRows = rows.filter((row) => row.value.trim());
  const rowGap = 22;
  const rowLabelW = 170;
  const rowValueW = innerW - rowLabelW - 22;
  const rowHeights: number[] = [];

  {
    const temp = document.createElement("canvas");
    const measure = temp.getContext("2d");
    if (!measure) throw new Error("Canvas not supported");
    measure.font = "600 16px system-ui, -apple-system, sans-serif";
    for (const row of normalRows) {
      rowHeights.push(Math.max(22, wrapText(measure, row.value, rowValueW).length * 22));
    }
  }

  const tokenLines =
    payload.tokenLabel && payload.tokenValue
      ? Math.max(1, String(payload.tokenValue).split(/\s+/).length)
      : 0;
  const tokenH = tokenLines ? Math.max(116, 78 + Math.ceil(tokenLines / 3) * 24) : 0;
  const headerH = 238;
  const amountH = 112;
  const detailsTopH = 62;
  const footerH = 96;
  const detailsH = rowHeights.reduce((sum, h) => sum + (h ?? 0) + rowGap, 0) + 34;
  const height = 44 + headerH + amountH + detailsTopH + detailsH + tokenH + footerH + 44;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Soft premium background.
  const pageGrad = ctx.createLinearGradient(0, 0, width, height);
  pageGrad.addColorStop(0, "#F5F3FF");
  pageGrad.addColorStop(0.5, "#EEF2FF");
  pageGrad.addColorStop(1, "#F8FAFC");
  ctx.fillStyle = pageGrad;
  ctx.fillRect(0, 0, width, height);

  // Receipt card.
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.12)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, cardX, 24, cardW, height - 48, 30);
  ctx.fill();
  ctx.restore();

  // Branded top panel.
  const topGrad = ctx.createLinearGradient(cardX, 24, cardX + cardW, 190);
  topGrad.addColorStop(0, "#5B21B6");
  topGrad.addColorStop(0.52, "#7C3AED");
  topGrad.addColorStop(1, "#4F46E5");
  ctx.save();
  ctx.fillStyle = topGrad;
  roundRect(ctx, cardX, 24, cardW, 184, 30);
  ctx.fill();
  ctx.restore();

  // Subtle decorative circles.
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cardX + cardW - 70, 65, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cardX + 42, 175, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  let y = 54;
  let drewLogo = false;
  try {
    const logo = await loadImage(BRAND.markUrl || BRAND.logoUrl);
    const logoH = 46;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, (width - logoW) / 2, y, logoW, logoH);
    y += logoH + 14;
    drewLogo = true;
  } catch {
    // fallback below
  }
  if (!drewLogo) {
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, width / 2 - 23, y, 46, 46, 13);
    ctx.fill();
    ctx.fillStyle = "#7C3AED";
    ctx.font = "800 25px system-ui, -apple-system, sans-serif";
    drawCenteredText(ctx, "R", width / 2, y + 32);
    y += 60;
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 24px system-ui, -apple-system, sans-serif";
  drawCenteredText(ctx, BRAND.name, width / 2, y + 4);
  y += 38;
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "500 13px system-ui, -apple-system, sans-serif";
  drawCenteredText(ctx, "TRANSACTION RECEIPT", width / 2, y);

  // Status + amount section.
  const statusY = 234;
  drawStatusIcon(ctx, status, width / 2, statusY);
  ctx.fillStyle = statusColor(status);
  ctx.font = "800 16px system-ui, -apple-system, sans-serif";
  drawCenteredText(ctx, statusLabel(status), width / 2, statusY + 49);

  ctx.fillStyle = "#0F172A";
  ctx.font = "900 48px system-ui, -apple-system, sans-serif";
  const amountText = payload.amountLabel.replace(/^\+/, "");
  drawCenteredText(ctx, amountText, width / 2, statusY + 104);

  ctx.fillStyle = "#64748B";
  ctx.font = "500 13px system-ui, -apple-system, sans-serif";
  drawCenteredText(
    ctx,
    payload.direction === "in" ? "Money received" : "Amount paid",
    width / 2,
    statusY + 128,
  );

  // Transaction title.
  const titleY = statusY + 168;
  ctx.fillStyle = "#F8FAFC";
  roundRect(ctx, innerX, titleY, innerW, 76, 18);
  ctx.fill();
  ctx.fillStyle = "#94A3B8";
  ctx.font = "600 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("TRANSACTION", innerX + 20, titleY + 27);
  ctx.fillStyle = "#172033";
  ctx.font = "800 18px system-ui, -apple-system, sans-serif";
  const titleLines = wrapText(ctx, payload.title || "Payment", innerW - 40).slice(0, 2);
  titleLines.forEach((line, index) => ctx.fillText(line, innerX + 20, titleY + 51 + index * 21));

  // Details heading.
  let detailsY = titleY + 102;
  ctx.fillStyle = "#0F172A";
  ctx.font = "800 17px system-ui, -apple-system, sans-serif";
  ctx.fillText("Payment details", innerX, detailsY);
  detailsY += 30;

  // Clean two-column rows with wrapping values.
  normalRows.forEach((row, index) => {
    const rowH = rowHeights[index] ?? 28;
    ctx.fillStyle = "#64748B";
    ctx.font = "600 12px system-ui, -apple-system, sans-serif";
    ctx.fillText(row.label, innerX, detailsY + 16);

    ctx.fillStyle = "#172033";
    ctx.font = "600 14px system-ui, -apple-system, sans-serif";
    const lines = wrapText(ctx, row.value, rowValueW).slice(0, 3);
    lines.forEach((line, lineIndex) => {
      ctx.fillText(line, innerX + rowLabelW + 22, detailsY + 16 + lineIndex * 22);
    });

    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX, detailsY + rowH + 8);
    ctx.lineTo(innerX + innerW, detailsY + rowH + 8);
    ctx.stroke();
    detailsY += rowH + rowGap;
  });

  // Special credential/token panel.
  if (payload.tokenLabel && payload.tokenValue) {
    detailsY += 4;
    const panelY = detailsY;
    const panelH = tokenH;
    ctx.fillStyle = "#F5F3FF";
    roundRect(ctx, innerX, panelY, innerW, panelH, 20);
    ctx.fill();
    ctx.strokeStyle = "#DDD6FE";
    ctx.lineWidth = 1;
    roundRect(ctx, innerX, panelY, innerW, panelH, 20);
    ctx.stroke();

    ctx.fillStyle = "#6D28D9";
    ctx.font = "800 12px system-ui, -apple-system, sans-serif";
    ctx.fillText(payload.tokenLabel.toUpperCase(), innerX + 20, panelY + 25);
    ctx.fillStyle = "#94A3B8";
    ctx.font = "500 11px system-ui, -apple-system, sans-serif";
    ctx.fillText("Keep this information safe", innerX + 20, panelY + 44);

    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, innerX + 18, panelY + 58, innerW - 36, panelH - 76, 14);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.font = "800 20px ui-monospace, SFMono-Regular, Menlo, monospace";
    const tokenText = String(payload.tokenValue);
    const tokenParts = tokenText.split(/\s+/).filter(Boolean);
    const tokenLinesArr: string[] = [];
    let tokenLine = "";
    for (const part of tokenParts.length ? tokenParts : [tokenText]) {
      const candidate = tokenLine ? `${tokenLine}   ${part}` : part;
      if (ctx.measureText(candidate).width > innerW - 72 && tokenLine) {
        tokenLinesArr.push(tokenLine);
        tokenLine = part;
      } else {
        tokenLine = candidate;
      }
    }
    if (tokenLine) tokenLinesArr.push(tokenLine);
    tokenLinesArr.slice(0, 4).forEach((line, index) => {
      drawCenteredText(ctx, line, width / 2, panelY + 86 + index * 24);
    });
  }

  // Footer.
  const footerY = height - footerH - 22;
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(innerX, footerY);
  ctx.lineTo(innerX + innerW, footerY);
  ctx.stroke();

  ctx.fillStyle = "#64748B";
  ctx.font = "500 12px system-ui, -apple-system, sans-serif";
  drawCenteredText(ctx, BRAND.supportEmail, width / 2, footerY + 31);
  ctx.fillStyle = "#94A3B8";
  ctx.font = "500 11px system-ui, -apple-system, sans-serif";
  drawCenteredText(ctx, `Securely processed by ${BRAND.name}`, width / 2, footerY + 52);
  ctx.fillStyle = "#CBD5E1";
  drawCenteredText(ctx, "PAY  •  FUND  •  CONNECT", width / 2, footerY + 73);

  // Receipt-style perforated bottom edge.
  drawPerforation(ctx, cardX + 12, height - 25, cardW - 24);

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
  return new Blob([(pdf.buffer as ArrayBuffer)], { type: "application/pdf" });
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
