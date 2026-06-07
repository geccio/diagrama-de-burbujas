import type { ParsedTable } from "./types";

// pdf.js needs a worker. Resolve the worker file as a bundler URL via
// import.meta.url — works in both Turbopack (Next 16) and Vercel builds
// without copying files into /public.
import * as pdfjsLib from "pdfjs-dist";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
}

interface TextItem {
  str: string;
  x: number;
  y: number;
}

/**
 * Best-effort table extraction from a PDF.
 * Strategy: read each page's positioned text items, group items into rows by
 * similar y, then into columns by clustering x positions. The first row is
 * treated as headers.
 *
 * PDFs do not store true table structure, so results are approximate.
 */
export async function parsePdf(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const allItems: TextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    for (const item of content.items) {
      const it = item as { str: string; transform: number[] };
      const str = (it.str ?? "").trim();
      if (!str) continue;
      const x = it.transform[4];
      // Flip y so top of page is small y (reading order top->bottom).
      const y = viewport.height - it.transform[5];
      allItems.push({ str, x, y });
    }
  }

  if (allItems.length === 0) {
    throw new Error(
      "No selectable text found in the PDF. It may be scanned/image-only."
    );
  }

  // Group into rows by y proximity.
  allItems.sort((a, b) => a.y - b.y || a.x - b.x);
  const rowTolerance = 6;
  const rawRows: TextItem[][] = [];
  let current: TextItem[] = [];
  let lastY = allItems[0].y;
  for (const item of allItems) {
    if (Math.abs(item.y - lastY) > rowTolerance && current.length) {
      rawRows.push(current);
      current = [];
    }
    current.push(item);
    lastY = item.y;
  }
  if (current.length) rawRows.push(current);

  // Determine column boundaries by clustering x positions across all items.
  const xs = allItems.map((i) => i.x).sort((a, b) => a - b);
  const colTolerance = 24;
  const centers: number[] = [];
  for (const x of xs) {
    const last = centers[centers.length - 1];
    if (last === undefined || x - last > colTolerance) {
      centers.push(x);
    }
  }

  function colIndex(x: number): number {
    let best = 0;
    let bestDist = Infinity;
    centers.forEach((c, i) => {
      const d = Math.abs(c - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  // Build a matrix: each row -> cells indexed by column.
  const matrix: string[][] = rawRows.map((rowItems) => {
    const cells: string[] = new Array(centers.length).fill("");
    rowItems
      .sort((a, b) => a.x - b.x)
      .forEach((it) => {
        const ci = colIndex(it.x);
        cells[ci] = cells[ci] ? `${cells[ci]} ${it.str}` : it.str;
      });
    return cells.map((c) => c.trim());
  });

  // Drop leading/trailing fully-empty rows.
  const dataMatrix = matrix.filter((r) => r.some((c) => c !== ""));
  if (dataMatrix.length < 2) {
    throw new Error(
      "Could not detect a table structure in the PDF. Try a spreadsheet export instead."
    );
  }

  const rawHeaders = dataMatrix[0];
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h, i) => {
    let name = h || `Column ${i + 1}`;
    if (seen.has(name)) {
      const n = (seen.get(name) ?? 0) + 1;
      seen.set(name, n);
      name = `${name} (${n})`;
    } else {
      seen.set(name, 0);
    }
    return name;
  });

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < dataMatrix.length; r++) {
    const obj: Record<string, string> = {};
    headers.forEach((h, c) => {
      obj[h] = dataMatrix[r][c] ?? "";
    });
    if (Object.values(obj).some((v) => v !== "")) rows.push(obj);
  }

  return { headers, rows, approximate: true };
}
