# Bubble Diagram Tool — Design Document

A browser-based architectural **space-planning bubble diagram** tool. Upload a
spreadsheet (Excel/CSV) or PDF, turn rows into draggable bubbles sized by area,
connect them by adjacency, organize them across layer tabs, and measure in meters.

## Understanding Summary

- **What:** Client-side web app that converts tabular room/space data into bubble diagrams.
- **Why:** Quickly produce classic early-design bubble diagrams (spaces, relative sizes, adjacencies).
- **Who:** Architecture / space-planning user.
- **Connections:** Click bubble A then bubble B to link; click a link to remove it.
- **Tabs:** Layers (floors/zones), each with its own bubbles, links, drawings.
- **Measure tool:** Draw lines that report length in meters via a fixed pixels-per-meter ratio.
- **Persistence:** Auto-save to localStorage.
- **Export:** PNG and PDF.
- **Background image:** Optional / future.
- **Deploy:** Push to GitHub, then deploy to Vercel.

## Assumptions

1. Fully client-side, single-user, no backend or login.
2. Stack: Next.js (App Router) + React + react-konva canvas.
3. PDF extraction is best-effort; Excel/CSV is the reliable path.
4. Bubble area ∝ size value (radius ∝ √value); non-numeric → uniform.
5. Fixed editable pixels-per-meter ratio; calibration deferred.
6. Deployable to Vercel (final step).

## Tech Stack

- **Next.js + React + TypeScript** — Vercel-native, zero-config deploy.
- **react-konva / konva** — interactive 2D canvas (drag, click-connect, draw, PNG export).
- **xlsx (SheetJS)** — parse Excel/CSV.
- **pdfjs-dist** — best-effort PDF table text extraction.
- **jspdf** — PDF export.
- **zustand** — state management.
- **Tailwind CSS** — styling.

## Data Model

```ts
Diagram {
  layers: Layer[]
  activeLayerId: string
  pixelsPerMeter: number
}
Layer {
  id: string
  name: string
  bubbles: Bubble[]
  links: Link[]
  drawings: Drawing[]
}
Bubble { id, x, y, radius, label, value?, color }
Link   { id, fromBubbleId, toBubbleId }
Drawing { id, points: number[], lengthMeters: number }
```

The whole Diagram auto-saves to localStorage (debounced) and restores on load.

## Data Flow (Upload → Bubbles)

1. Detect file type by extension.
2. Parse: SheetJS for xlsx/csv; pdf.js (group text by x/y) for PDF.
3. Column picker: choose **label** column (required) and optional numeric **size** column.
4. Generate one bubble per row; `radius ∝ √value` clamped to min/max; auto-layout grid.
5. Add to active layer; option to add-to or replace.

Edge cases: blank labels skipped/"(blank)"; non-numeric size → default radius;
extreme ranges clamped; re-upload add/replace.

## Canvas Modes

- **Select:** drag bubbles; click to select (rename/recolor/resize/delete); double-click to edit label.
- **Connect:** click A then B to link; click link to select+delete; same bubble twice cancels.
- **Draw/Measure:** click points; per-segment + total length in meters; Esc/double-click finishes.
- **Scale:** pixels-per-meter field; live updates; optional 1m grid.
- Pan + zoom; light grid background.

## Tabs, Persistence, Export

- Tab bar: add (+), rename (double-click), delete (×, confirm); switching swaps canvas content.
- Auto-save to localStorage (debounced ~500ms); restore on load; Reset option.
- Export PNG via `stage.toDataURL()`; PDF via jsPDF (active layer or all layers, one page each);
  hide selection UI during export.

## Decision Log

| Decision | Alternatives | Why |
|---|---|---|
| Next.js + react-konva | vanilla canvas; React Flow | Best fit for free-form canvas + draw + export; Vercel-native |
| SheetJS + pdf.js (client) | server parsing | Keeps app client-side/private |
| radius ∝ √value | radius ∝ value | Area proportional to value (correct for room areas) |
| Click A then B to connect | drag edge-to-edge | User choice; simple; clear disconnect |
| Fixed pixels-per-meter | calibrate by length | User choice; simpler; calibration deferred |
| localStorage auto-save | project files; none | User choice; zero-friction, private |
| Zustand | Redux; Context | Minimal boilerplate for canvas state |

## Non-Goals (v1)

- No backend, accounts, or multi-user collaboration.
- No calibration-by-known-length (fixed ratio only).
- Background floor-plan image is future work.
