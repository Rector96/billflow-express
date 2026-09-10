import { BRAND } from "@/lib/brand";
import type { ReceiptPayload } from "@/lib/receipt-share";

function canvasToBlobViaDataUrl(
  canvas: HTMLCanvasElement,
  type: string,
  quality = 0.95,
): Promise<Blob> {
  const dataUrl = canvas.toDataURL(type, quality);
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Could not encode receipt image");
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return Promise.resolve(new Blob([bytes], { type }));
}

function drawFallbackReceipt(payload: ReceiptPayload): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1120;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const pad = 48;
  const max = canvas.width - pad * 2;
  ctx.fillStyle = "#F4F2FF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(15,23,42,.12)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.beginPath();
  ctx.roundRect(28, 28, 664, 1064, 28);
  ctx.fill();
  ctx.shadowColor = "transparent";

  const grad = ctx.createLinearGradient(28, 28, 692, 210);
  grad.addColorStop(0, "#5B21B6");
  grad.addColorStop(0.55, "#7C3AED");
  grad.addColorStop(1, "#4F46E5");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(28, 28, 664, 182, 28);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.font = "800 28px system-ui, sans-serif";
  ctx.fillText(BRAND.name, 360, 92);
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.fillText("TRANSACTION RECEIPT", 360, 118);

  const status = String(payload.status || "unknown");
  const statusColor =
    status === "successful" ? "#10B981" : status === "failed" ? "#EF4444" : "#F59E0B";
  ctx.fillStyle = statusColor;
  ctx.font = "800 16px system-ui, sans-serif";
  ctx.fillText(
    status === "successful" ? "Successful" : status === "failed" ? "Failed" : "Pending",
    360,
    258,
  );

  ctx.fillStyle = "#0F172A";
  ctx.font = "900 44px system-ui, sans-serif";
  ctx.fillText(payload.amountLabel || "₦0", 360, 318);
  ctx.fillStyle = "#64748B";
  ctx.font = "500 13px system-ui, sans-serif";
  ctx.fillText(payload.title || "Payment", 360, 344);
  ctx.textAlign = "left";

  ctx.fillStyle = "#F8FAFC";
  ctx.beginPath();
  ctx.roundRect(pad, 380, max, 62, 16);
  ctx.fill();
  ctx.fillStyle = "#94A3B8";
  ctx.font = "700 10px system-ui, sans-serif";
  ctx.fillText("TRANSACTION ID", pad + 18, 405);
  ctx.fillStyle = "#172033";
  ctx.font = "700 14px ui-monospace, monospace";
  ctx.fillText(String(payload.reference || "—").slice(0, 48), pad + 18, 427);

  const rows: Array<[string, string]> = [];
  if (payload.network) rows.push(["Provider", payload.network]);
  if (payload.service) rows.push(["Service", payload.service]);
  if (payload.recipient) rows.push(["Recipient", payload.recipient]);
  if (payload.dateLabel) rows.push(["Date & time", payload.dateLabel]);
  if (payload.providerRef) rows.push(["Provider reference", payload.providerRef]);
  if (payload.channel) rows.push(["Channel", payload.channel]);
  if (payload.method) rows.push(["Payment method", payload.method]);
  if (payload.detailRows) for (const row of payload.detailRows) rows.push([row.label, row.value]);

  let y = 488;
  ctx.font = "600 13px system-ui, sans-serif";
  for (const [label, value] of rows.slice(0, 10)) {
    ctx.fillStyle = "#64748B";
    ctx.fillText(label, pad, y);
    ctx.fillStyle = "#172033";
    ctx.font = "600 14px system-ui, sans-serif";
    const text = String(value || "—");
    const clipped = text.length > 52 ? `${text.slice(0, 49)}…` : text;
    ctx.fillText(clipped, pad + 190, y);
    ctx.strokeStyle = "#E2E8F0";
    ctx.beginPath();
    ctx.moveTo(pad, y + 16);
    ctx.lineTo(canvas.width - pad, y + 16);
    ctx.stroke();
    ctx.font = "600 13px system-ui, sans-serif";
    y += 54;
  }

  if (payload.tokenLabel && payload.tokenValue) {
    ctx.fillStyle = "#F5F3FF";
    ctx.beginPath();
    ctx.roundRect(pad, y + 8, max, 118, 18);
    ctx.fill();
    ctx.fillStyle = "#6D28D9";
    ctx.font = "800 12px system-ui, sans-serif";
    ctx.fillText(String(payload.tokenLabel).toUpperCase(), pad + 18, y + 36);
    ctx.fillStyle = "#111827";
    ctx.font = "800 19px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(payload.tokenValue).slice(0, 44), 360, y + 82);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#94A3B8";
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(BRAND.supportEmail, 360, 1040);
  ctx.fillText(`Securely processed by ${BRAND.name}`, 360, 1062);
  ctx.textAlign = "left";
  return canvas;
}

export async function renderFallbackReceiptPng(payload: ReceiptPayload): Promise<Blob> {
  return canvasToBlobViaDataUrl(drawFallbackReceipt(payload), "image/png", 1);
}

export async function renderFallbackReceiptPdf(payload: ReceiptPayload): Promise<Blob> {
  const canvas = drawFallbackReceipt(payload);
  const jpeg = await canvasToBlobViaDataUrl(canvas, "image/jpeg", 0.92);
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  const pageW = 400;
  const scale = pageW / canvas.width;
  const pageH = Math.round(canvas.height * scale);
  const pdfBytes = buildPdf(bytes, pageW, pageH, canvas.width, canvas.height);
  return new Blob([pdfBytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
}

function buildPdf(
  jpeg: Uint8Array,
  pageW: number,
  pageH: number,
  imgW: number,
  imgH: number,
): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const offsets: number[] = [];
  const str = (value: string) => {
    const bytes = encoder.encode(value);
    chunks.push(bytes);
    size += bytes.length;
  };
  const raw = (bytes: Uint8Array) => {
    chunks.push(bytes);
    size += bytes.length;
  };
  const obj = () => offsets.push(size);

  str("%PDF-1.4\n");
  obj();
  str("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  obj();
  str("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  obj();
  str(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );
  obj();
  str(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  raw(jpeg);
  str("\nendstream\nendobj\n");
  const stream = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im1 Do\nQ\n`;
  obj();
  str(`5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);
  const xref = size;
  str(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) str(`${String(offset).padStart(10, "0")} 00000 n \n`);
  str(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
