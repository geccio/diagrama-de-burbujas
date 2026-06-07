# 🫧 Bubble Diagram Tool

Create architectural **space-planning bubble diagrams** directly from your data.
Upload an Excel, CSV, or PDF; pick a label column and an optional area column;
each row becomes a draggable bubble sized by its area. Connect bubbles to show
adjacencies, organize spaces across layer tabs (floors/zones), and measure
distances in meters.

Fully client-side — your data never leaves your browser.

## Features

- **Upload Excel (.xlsx/.xls), CSV, or PDF** — pick the label column and an
  optional numeric size column. Bubble *area* scales with the value.
  (PDF table extraction is best-effort; spreadsheets are the reliable path.)
- **Connect / disconnect** — in Connect mode, click bubble A then bubble B to
  link them; click a link and delete it to disconnect.
- **Layer tabs** — separate floors or zones; each tab has its own bubbles,
  links, and drawings. Add (+), rename (double-click), delete (×).
- **Measure tool** — in Measure mode, click points to draw a polyline; each
  segment and the total report length in **meters** using an editable
  pixels-per-meter scale.
- **Select mode** — drag bubbles, rename, recolor, resize, edit area, delete.
- **Categories** — bubbles auto-categorized (Service Core / Public / Services /
  Infrastructure) and color-coded; override per bubble. Legend included.
- **Auto-arrange** — cluster bubbles into clean columns by category; zoom-to-fit.
- **Connections** — solid (sure/direct) and dashed (intermittent/uncertain) links.
- **Area totals panel** — live total m² per category, per layer, with % bars.
- **Background floor plan** — upload a plan image per layer with opacity + lock,
  and trace/measure over it.
- **Undo / Redo** — Ctrl+Z / Ctrl+Shift+Z across all edits.
- **Save / Load project files** — export the whole diagram (incl. images) to a
  portable `.json` and reopen it anywhere.
- **Pan & zoom** — drag empty canvas to pan, scroll to zoom.
- **Auto-save** — everything persists to your browser (localStorage).
- **Export** — download the current view as **PNG** or **PDF**.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- react-konva / Konva (interactive canvas)
- SheetJS (xlsx) + pdf.js (parsing)
- jsPDF (PDF export)
- Zustand (state) + Tailwind CSS

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

A sample dataset is included at `public/sample-rooms.csv` to try the upload flow.

## Deploy

Optimized for Vercel — import the repo at [vercel.com/new](https://vercel.com/new)
and deploy with the default Next.js settings (no environment variables needed).

## How bubble sizing works

If you choose a size column, radius scales as `√value` so that the **area** of
each bubble is proportional to the value (correct for room areas in m²). Sizes
are clamped to a min/max so nothing is invisible or fills the screen.
