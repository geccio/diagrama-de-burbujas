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
  /** Per-floor area totals (mirrors the Totals panel's "By Floor" view). */
  floors: { name: string; color: string; area: number; count: number }[];
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
  // Grow the footer so EVERY category and floor row fits (no silent truncation):
  // rows start 40px below the footer top and need 24px each, plus 8px padding.
  const totalRows = Math.max(meta.categories.length, meta.floors.length);
  const footerH = Math.max(
    meta.floors.length > 0 ? 190 : 150,
    totalRows * 24 + 48
  );
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

  const colW = 250;
  const rowH = 24;
  const rowsTop = footerY + 40;
  const rowsBottom = footerY + footerH - 8;

  // Generic "color dot + label … value" row drawer; returns the next y.
  const drawRow = (
    x: number,
    y: number,
    color: string,
    label: string,
    value: string
  ) => {
    ctx.textAlign = "left";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 6, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.fg;
    ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
    // Truncate long labels so they never run into the right-aligned value.
    ctx.save();
    ctx.font = "13px ui-monospace, monospace";
    const valueW = ctx.measureText(value).width;
    ctx.restore();
    const maxLabelW = colW - 24 - 20 - valueW - 8;
    let shown = label;
    if (ctx.measureText(shown).width > maxLabelW) {
      while (shown.length > 1 && ctx.measureText(shown + "…").width > maxLabelW) {
        shown = shown.slice(0, -1);
      }
      shown += "…";
    }
    ctx.fillText(shown, x + 20, y);
    ctx.textAlign = "right";
    ctx.fillStyle = t.muted;
    ctx.font = "13px ui-monospace, monospace";
    ctx.fillText(value, x + colW - 24, y);
    ctx.textAlign = "left";
  };

  // Column 1: category totals.
  ctx.textAlign = "left";
  ctx.fillStyle = t.muted;
  ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("CATEGORY TOTALS", pad, footerY + 16);

  let cx = pad;
  let cy = rowsTop;
  for (const c of meta.categories) {
    if (cy + rowH > rowsBottom) {
      cx += colW;
      cy = rowsTop;
    }
    const cat = CATEGORIES[c.id];
    drawRow(cx, cy, cat.color, cat.label, `${formatArea(c.area)} m² · ${c.count}`);
    cy += rowH;
  }

  // Column 2: floor totals (mirrors the Totals panel's "By Floor" view).
  if (meta.floors.length > 0) {
    let fx = pad + colW;
    let fy = rowsTop;
    ctx.textAlign = "left";
    ctx.fillStyle = t.muted;
    ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("FLOOR TOTALS", fx, footerY + 16);
    for (const f of meta.floors) {
      // The footer is sized so all rows fit; wrap to a new column as a safety net.
      if (fy + rowH > rowsBottom) {
        fx += colW;
        fy = rowsTop;
      }
      drawRow(fx, fy, f.color, f.name, `${formatArea(f.area)} m² · ${f.count}`);
      fy += rowH;
    }
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
