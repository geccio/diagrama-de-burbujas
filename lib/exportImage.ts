import type Konva from "konva";
import { jsPDF } from "jspdf";
import { CATEGORIES, type CategoryId } from "./categories";

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export interface SheetMeta {
  title: string;
  date: string;
  layerName: string;
  theme: "light" | "dark";
  totalArea: number;
  bubbleCount: number;
  categories: { id: CategoryId; area: number; count: number }[];
  hasConnections: boolean;
}

/**
 * Compose a presentation sheet: the diagram image plus a title block, legend,
 * and area totals. Resolves to a data URL once the diagram image has loaded.
 */
async function buildSheet(stage: Konva.Stage, meta: SheetMeta) {
  const pixelRatio = 2;
  const diagramUrl = stage.toDataURL({ pixelRatio });
  const img = await loadImage(diagramUrl);

  const dark = meta.theme === "dark";
  const bg = dark ? "#0f1115" : "#ffffff";

  const W = stage.width();
  const H = stage.height();
  const headerH = 70;
  const footerH = 150;
  const sheetW = W;
  const sheetH = headerH + H + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = sheetW * pixelRatio;
  canvas.height = sheetH * pixelRatio;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(pixelRatio, pixelRatio);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, sheetW, sheetH);

  drawHeader(ctx, meta, sheetW, headerH);
  ctx.drawImage(img, 0, headerH, W, H);
  drawFooter(ctx, meta, sheetW, headerH + H, footerH);

  return { dataUrl: canvas.toDataURL("image/png"), width: sheetW, height: sheetH };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function colorTokens(dark: boolean) {
  return {
    fg: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#64748b",
    border: dark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)",
    surface: dark ? "#181b22" : "#f8fafc",
  };
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  meta: SheetMeta,
  sheetW: number,
  headerH: number
) {
  const t = colorTokens(meta.theme === "dark");
  const pad = 24;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = t.fg;
  ctx.font = "bold 22px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(meta.title || "Bubble Diagram", pad, headerH / 2 - 8);
  ctx.fillStyle = t.muted;
  ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(`${meta.layerName} · ${meta.date}`, pad, headerH / 2 + 14);

  ctx.textAlign = "right";
  ctx.fillStyle = t.fg;
  ctx.font = "bold 22px ui-monospace, monospace";
  ctx.fillText(`${formatArea(meta.totalArea)} m²`, sheetW - pad, headerH / 2 - 8);
  ctx.fillStyle = t.muted;
  ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(`${meta.bubbleCount} spaces`, sheetW - pad, headerH / 2 + 14);
  ctx.textAlign = "left";

  ctx.strokeStyle = t.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerH);
  ctx.lineTo(sheetW, headerH);
  ctx.stroke();
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  meta: SheetMeta,
  sheetW: number,
  footerY: number,
  footerH: number
) {
  const t = colorTokens(meta.theme === "dark");
  const pad = 24;
  ctx.fillStyle = t.surface;
  ctx.fillRect(0, footerY, sheetW, footerH);
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(sheetW, footerY);
  ctx.stroke();

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = t.muted;
  ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("CATEGORY TOTALS", pad, footerY + 16);

  const colW = 250;
  const rowH = 24;
  let cx = pad;
  let cy = footerY + 40;
  ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
  for (const c of meta.categories) {
    if (cy + rowH > footerY + footerH - 8) {
      cx += colW;
      cy = footerY + 40;
    }
    const cat = CATEGORIES[c.id];
    ctx.fillStyle = cat.color;
    ctx.beginPath();
    ctx.arc(cx + 6, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.fg;
    ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(cat.label, cx + 20, cy);
    ctx.textAlign = "right";
    ctx.fillStyle = t.muted;
    ctx.font = "13px ui-monospace, monospace";
    ctx.fillText(`${formatArea(c.area)} m² · ${c.count}`, cx + colW - 24, cy);
    ctx.textAlign = "left";
    cy += rowH;
  }

  if (meta.hasConnections) {
    const keyX = sheetW - pad - 190;
    let ky = footerY + 40;
    ctx.fillStyle = t.muted;
    ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("CONNECTIONS", keyX, footerY + 16);
    ctx.strokeStyle = t.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(keyX, ky);
    ctx.lineTo(keyX + 26, ky);
    ctx.stroke();
    ctx.fillStyle = t.fg;
    ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("Sure / direct", keyX + 34, ky);
    ky += 22;
    ctx.strokeStyle = t.muted;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(keyX, ky);
    ctx.lineTo(keyX + 26, ky);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText("Intermittent", keyX + 34, ky);
  }
}

function formatArea(v: number): string {
  if (!v) return "0";
  return Number.isInteger(v)
    ? v.toLocaleString()
    : v.toFixed(1).replace(/\.0$/, "");
}

/** Export the current view (no extras) — kept for the simple path. */
export function exportStagePng(stage: Konva.Stage, name = "bubble-diagram") {
  triggerDownload(stage.toDataURL({ pixelRatio: 2 }), `${name}.png`);
}

export function exportStagePdf(stage: Konva.Stage, name = "bubble-diagram") {
  const dataUrl = stage.toDataURL({ pixelRatio: 2 });
  const w = stage.width();
  const h = stage.height();
  const pdf = new jsPDF({
    orientation: w >= h ? "landscape" : "portrait",
    unit: "px",
    format: [w, h],
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
  pdf.save(`${name}.pdf`);
}

/** Rich export: full sheet with title block, legend, and totals. */
export async function exportSheetPng(
  stage: Konva.Stage,
  meta: SheetMeta,
  name = "bubble-diagram"
) {
  const { dataUrl } = await buildSheet(stage, meta);
  triggerDownload(dataUrl, `${name}.png`);
}

export async function exportSheetPdf(
  stage: Konva.Stage,
  meta: SheetMeta,
  name = "bubble-diagram"
) {
  const { dataUrl, width, height } = await buildSheet(stage, meta);
  const pdf = new jsPDF({
    orientation: width >= height ? "landscape" : "portrait",
    unit: "px",
    format: [width, height],
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
  pdf.save(`${name}.pdf`);
}
