// Compute a label that fits inside a circular bubble.
//
// A circle of radius r has an inscribed square of side r*√2. Text laid out in
// that square stays inside the circle. We measure real glyph widths with a
// canvas 2D context (no guesswork), pick the largest font size at which the
// word-wrapped text fits the available height, and truncate with an ellipsis if
// it still doesn't fit at the minimum size.

export interface FitResult {
  fontSize: number;
  /** Wrapped text with explicit "\n" breaks (render with wrap="none"). */
  text: string;
  /** Width of the text box (the inscribed square side). */
  boxWidth: number;
  truncated: boolean;
}

const MIN_FONT = 8;
const MAX_FONT = 18;
const LINE_H_RATIO = 1.15;
const FONT_FAMILY = "ui-sans-serif, system-ui, sans-serif";

// Reusable offscreen canvas context for text measurement.
let measureCtx: CanvasRenderingContext2D | null = null;
function getCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCtx) {
    const canvas = document.createElement("canvas");
    measureCtx = canvas.getContext("2d");
  }
  return measureCtx;
}

function measure(ctx: CanvasRenderingContext2D, text: string, font: number): number {
  ctx.font = `700 ${font}px ${FONT_FAMILY}`;
  return ctx.measureText(text).width;
}

/**
 * @param label   full label text
 * @param radius  bubble radius in px
 * @param reserve vertical px to reserve (e.g. for an "m²" line below)
 */
export function fitBubbleLabel(
  label: string,
  radius: number,
  reserve = 0
): FitResult {
  const side = radius * Math.SQRT2;
  const boxWidth = side * 0.92; // small horizontal padding
  const boxHeight = Math.max(8, side - reserve - 4);
  const words = label.trim().split(/\s+/).filter(Boolean);
  const ctx = getCtx();

  // No canvas (SSR) — fall back to a coarse estimate.
  if (!ctx) {
    const font = Math.max(MIN_FONT, Math.min(MAX_FONT, radius * 0.4));
    return { fontSize: Math.round(font), text: label, boxWidth, truncated: false };
  }

  // Largest font whose wrapped text fits the box height.
  for (let font = MAX_FONT; font >= MIN_FONT; font--) {
    const lines = wrapWords(ctx, words, boxWidth, font);
    const totalHeight = lines.length * font * LINE_H_RATIO;
    if (totalHeight <= boxHeight) {
      return { fontSize: font, text: lines.join("\n"), boxWidth, truncated: false };
    }
  }

  // Doesn't fit at MIN_FONT — keep the lines that fit and add an ellipsis.
  const font = MIN_FONT;
  const lines = wrapWords(ctx, words, boxWidth, font);
  const maxLines = Math.max(1, Math.floor(boxHeight / (font * LINE_H_RATIO)));
  if (lines.length <= maxLines) {
    return { fontSize: font, text: lines.join("\n"), boxWidth, truncated: false };
  }

  const kept = lines.slice(0, maxLines);
  // Trim the last kept line until it + "…" fits.
  let last = kept[kept.length - 1];
  while (last.length > 1 && measure(ctx, last + "…", font) > boxWidth) {
    last = last.slice(0, -1);
  }
  kept[kept.length - 1] = last.replace(/\s+$/, "") + "…";
  return { fontSize: font, text: kept.join("\n"), boxWidth, truncated: true };
}

/**
 * Greedy word wrap using real measured widths. A word wider than the box is
 * hard-split by characters; otherwise words stay whole (no "Ban o" breaks).
 */
function wrapWords(
  ctx: CanvasRenderingContext2D,
  words: string[],
  boxWidth: number,
  font: number
): string[] {
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    let w = word;
    // Hard-split a single word that can't fit on a line by itself.
    while (measure(ctx, w, font) > boxWidth && w.length > 1) {
      // Find the largest prefix that fits.
      let cut = w.length;
      while (cut > 1 && measure(ctx, w.slice(0, cut), font) > boxWidth) cut--;
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }

    const candidate = current ? `${current} ${w}` : w;
    if (measure(ctx, candidate, font) <= boxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}
