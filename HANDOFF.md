# Handoff — Bubble Diagram Tool

A browser-based **architectural space-planning bubble diagram** app. Upload a
spreadsheet/PDF (or describe it to a local AI), turn rooms into draggable bubbles
sized by area, connect them, organize by floor/layer, measure in meters, and
export. Everything runs client-side; the optional AI runs on the user's own
Ollama server.

- **Repo:** https://github.com/geccio/diagrama-de-burbujas (branch `main`)
- **Live:** Vercel auto-deploys `main` (project `diagrama-de-burbujas`)
- **Status:** Fully working; production build is clean. Last commit at handoff:
  `69275a9` "Copy / paste / duplicate bubbles".

---

## 👋 If you are a new agent, start here

**What this project is:** a single-page, fully client-side Next.js app. No
backend, no database, no auth. All state is one Zustand store persisted to
`localStorage`. An optional AI assistant calls the *user's own* local Ollama
from the browser.

**Read these three files first, in order:**
1. `lib/types.ts` — the entire data model (Diagram → Layers → bubbles/links/drawings).
2. `store/useDiagram.ts` — every piece of behavior lives here as a store action.
3. `app/page.tsx` — how the UI is composed and where global shortcuts live.
Then skim `components/Canvas.tsx` (the canvas) and `lib/aiTasks.ts` (AI prompts).

**The golden rules (don't skip):**
- Run `npm run build` after any change — it must pass (TypeScript is strict).
- New mutating store action? Call `commit(diagram, next, set)` so it's undoable.
  UI-only/settings change? Call `persist(next, set)`. High-frequency edits
  (every keystroke / slider tick, e.g. `updateBubble`)? Call
  `commitCoalesced(tag, diagram, next, set)` — one undo entry per burst.
- **Never** write a Zustand selector that returns a freshly-built array/object
  (`useDiagram(s => s.buildList())`) — infinite render loop. Select raw state,
  derive with `useMemo`. (See the "CRITICAL gotcha" below; it already bit once.)
- Konva code is client-only. `Canvas` is `dynamic(..., {ssr:false})`; keep new
  canvas code from running on the server.
- Icons are inline SVG in `components/icons.tsx` — no emoji, no icon library.
- Colors: CSS vars (`var(--color-*)`) in DOM; `lib/themeColors.ts` for the canvas.

**About the user (important for tone & workflow):**
- Non-developer; communicates in short, casual asks (often Spanish or brief
  English like "what else can we add", "make it so i can copy elements").
- Wants to **see it work** — they paste screenshots of the running/deployed app.
  After building, verify in a real browser and report concretely.
- Does **not** want to run terminal commands themselves. You do the building,
  testing, committing, and pushing. They confirm direction via questions.
- The flow each request: ask 1–3 clarifying questions (use AskUserQuestion with
  options) → build → `npm run build` → browser-verify → commit → push → tell
  them it's live on Vercel. Then offer 2–3 next-feature ideas.

**Environment (Windows):**
- Repo path: `c:\Users\gabri\OneDrive\Desktop\diagrama de burbujas claude`
  (note the spaces — quote paths).
- Git is set up and pushes to `origin/main` over HTTPS with stored credentials
  (no `gh` CLI). The `vercel` CLI is installed but the user prefers the GitHub→
  Vercel auto-deploy; you don't normally need to run `vercel`.
- The user has **Ollama running locally** with `qwen2.5:14b` (best for JSON
  tasks) and `llava:7b` (vision). Ollama already returns
  `Access-Control-Allow-Origin: *`, so browser calls work.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (also the CI/Vercel build)
npm run start    # serve the production build locally
```

A sample dataset is at `public/sample-rooms.csv`.

**Requirements:** Node 18+ (built/verified on Node 24). Windows note: the dev
server occasionally wedges — `taskkill /F /IM node.exe`, delete `.next`, restart.

---

## Tech stack

- **Next.js 16** (App Router, **Turbopack**) + **React 19** + **TypeScript**
- **react-konva / konva** — the interactive canvas (bubbles, links, drawings, images)
- **zustand** — single global store (`store/useDiagram.ts`)
- **Tailwind CSS** — styling via CSS variables (see Theming)
- **xlsx (SheetJS)** + **pdfjs-dist** — parse spreadsheets / PDFs (client-side)
- **jspdf** — PDF export
- No backend, no database, no auth. State lives in `localStorage`.

### Config notes / gotchas
- `next.config.mjs` aliases the Node-only `canvas` dep (pulled by pdfjs) to
  `lib/empty.js` for Turbopack. Don't remove it or the build breaks.
- `pdfjs-dist` worker is wired via `import.meta.url` in `lib/parsePdf.ts`.
- Konva must be client-only: `Canvas` is loaded with `dynamic(..., { ssr:false })`
  in `app/page.tsx`. Keep any new Konva code out of SSR.
- `xlsx` is installed from the SheetJS CDN tarball (see `package.json`), not npm.

---

## Architecture

### State — `store/useDiagram.ts` (the heart of the app)
One Zustand store holds the whole `Diagram` plus UI state. Key pieces:

- **Data model** (`lib/types.ts`): `Diagram → Layer[] → { bubbles, links, drawings, background }`.
  - `Bubble`: `{ id, x, y, radius, label, value?(m²), color, category?, floor? }`
  - `Link`: `{ id, fromBubbleId, toBubbleId, kind?: "solid"|"dashed" }`
  - `Background`: per-layer floor-plan image (data URL, opacity, locked).
- **Persistence:** debounced save to `localStorage` key `bubble-diagram-v1`
  (`lib/storage.ts`). Ollama settings live under `bubble-diagram-ollama`.
- **Undo/redo:** module-level `undoStack`/`redoStack` of cloned diagrams.
  Mutating actions call `commit(prev, next, set)` (records history). Pure UI/nav
  actions call `persist(next, set)` (no history). High-frequency edits use
  `commitCoalesced(tag, ...)` — same-tag commits within 1s collapse into one
  undo entry (label typing, sliders, scale, background opacity). Bubble drags
  push one history entry at `onDragStart` via `pushHistory()`.
- **Clipboard:** module-level `clipboard`; `copySelection` / `pasteClipboard` /
  `duplicateSelection` (keeps links whose both ends are copied).
- **UI flags in the store:** `mode` (select/connect/draw), `selectedBubbleId`,
  `selectedBubbleIds` (multi-select), `selectedLinkId`, `pendingConnectId`,
  `calibrating`, `floorFilter`, `fitRequest` (a counter the Canvas watches to
  zoom-to-fit), `canUndo/canRedo`, `saving`.

> **CRITICAL gotcha:** never write a Zustand selector that returns a NEW array/
> object each call, e.g. `useDiagram(s => s.someFn())` where `someFn` builds an
> array. It causes an infinite render loop ("Maximum update depth exceeded").
> Select raw state and derive with `useMemo` in the component. (This already bit
> the floor filter once — see git history.)

### UI — `app/page.tsx`
Composes the toolbar, tabs, the dynamically-imported `Canvas`, and all the
floating panels/modals. Owns modal open/close state and the global keyboard
shortcuts (undo/redo live in `Toolbar`; copy/paste/duplicate live in `page.tsx`).

### Components (`components/`)
| File | Role |
|---|---|
| `Canvas.tsx` | The Konva stage: renders bubbles, links, drawings, background image, tooltip, calibration line, box-select rect; handles pan/zoom, drag, click-to-connect, draw/measure, calibration, multi-select, zoom-to-fit. The biggest file. |
| `Toolbar.tsx` | Top bar: modes, upload, AI, arrange, fit, clear, matrix, scale + calibrate, floor filter, save/open, PNG/PDF, theme, reset, undo/redo. |
| `Tabs.tsx` | Layer tabs (add/rename/delete/switch). |
| `PropertyPanel.tsx` | Right panel when a bubble/link is selected (edit label/area/category/floor/color, duplicate, delete; link kind). Positioned by the right-side flex column in `page.tsx` (stacks above `SummaryPanel` so they never overlap). |
| `MultiSelectBar.tsx` | Top-center bar when 2+ bubbles selected (bulk recolor/recategorize/duplicate/delete). |
| `Legend.tsx` | Bottom-left category key + connection key + area scale. |
| `SummaryPanel.tsx` | Top-right area totals (per category, %, counts). |
| `BackgroundPanel.tsx` | Bottom-right floor-plan image controls (opacity/lock/replace/remove). |
| `ChatWidget.tsx` | Floating bottom-left AI chat (create+edit across turns). |
| `AiPanel.tsx` | AI modal: connection settings, generate, suggest adjacencies, edit, vision, design review + `OllamaSetupHelp`. |
| `OllamaSetupHelp.tsx` | Collapsible setup steps (auto-opens on connection error). |
| `UploadPanel.tsx` | Upload modal: parse, column mapping (incl. AI auto-map / AI build-from-file), note-row skipping. |
| `AdjacencyMatrix.tsx` | Modal bubbles×bubbles adjacency grid. |
| `BubbleLabel.tsx` | Auto-fits label text into the circle (canvas-measured); shows area + floor. |
| `icons.tsx` | Inline SVG icon set (no emoji, no icon lib). |

### Lib (`lib/`)
- `types.ts` — all shared types.
- `bubbleLayout.ts` — `radiusForValue` (area ∝ value), `clusterByCategory`,
  `gridPositions`, size constants.
- `categories.ts` — the 5 categories, colors, and keyword auto-detection (ES+EN).
- `fitText.ts` — canvas-measured label wrapping/truncation.
- `themeColors.ts` — canvas colors per theme (Konva can't read CSS vars).
- `parseSpreadsheet.ts` / `parsePdf.ts` / `parseNumber.ts` / `rowClassify.ts` — import pipeline.
- `exportImage.ts` — PNG/PDF "sheet" export (title block + legend + totals).
- `projectFile.ts` — save/load `.json` projects (embeds images).
- `readImage.ts` — image File → data URL + dimensions.
- `storage.ts`, `id.ts`, `empty.js`.
- **AI:** `ollama.ts` (client: `chatJson`, `chatJsonMessages`, `listModels`,
  `describeOllamaError`) + `aiTasks.ts` (prompts + result shapes for every AI
  feature).

---

## Feature map (where to look)

| Feature | Code |
|---|---|
| Upload Excel/CSV/PDF → bubbles | `UploadPanel.tsx`, `lib/parse*.ts`, store `addSpaces` |
| Skip note-like rows on import | `lib/rowClassify.ts` |
| Categories + color-coding + legend | `lib/categories.ts`, `Legend.tsx`, store `setBubbleCategory` |
| Area-proportional sizing | `lib/bubbleLayout.ts` `radiusForValue` |
| Connect / disconnect (solid/dashed) | `Canvas.tsx`, store `handleBubbleConnectClick`/`setLinkKind`/`deleteLink` |
| Layer tabs | `Tabs.tsx`, store layer actions |
| Auto-arrange by category / zoom-to-fit | store `arrangeByCategory` / `requestFit`; `Canvas` fit effect |
| Per-floor filter | `Toolbar` floor dropdown, store `floorFilter`, `Canvas` `onActiveFloor` |
| Measure tool (meters) + calibration | `Canvas.tsx` draw mode + calibration; store `setPixelsPerMeter`/`startCalibration` |
| Multi-select + bulk ops | `Canvas` box-select, `MultiSelectBar.tsx`, store `bulk*` |
| Copy/paste/duplicate | store `copySelection`/`pasteClipboard`/`duplicateSelection`; `page.tsx` shortcuts |
| Undo/redo | store history + `Toolbar` buttons/shortcuts |
| Totals panel | `SummaryPanel.tsx` |
| Background floor-plan image | `BackgroundPanel.tsx`, `Canvas` `BackgroundImage`, store `setBackground`/`updateBackground` |
| Save/Load `.json` | `lib/projectFile.ts`, store `loadDiagramObject`, `Toolbar` save/open |
| PNG/PDF rich export | `lib/exportImage.ts`, `Toolbar` `buildSheetMeta` |
| Adjacency matrix | `AdjacencyMatrix.tsx` |
| AI: generate / suggest / edit / build-from-file / column-map / chat / review / vision | `lib/aiTasks.ts`, `AiPanel.tsx`, `ChatWidget.tsx`, store `applyAiEdits`/`applyChatActions`/`addLinksByNames` |

---

## AI / Ollama notes

- Bring-your-own **local Ollama**. Endpoint + model are user-set in the AI panel
  and stored in `localStorage`. Default `http://localhost:11434`.
- The browser calls Ollama directly, so Ollama must allow the app origin:
  `OLLAMA_ORIGINS="*"` then restart. `OllamaSetupHelp.tsx` shows the exact steps
  and auto-opens on a connection error.
- **Model choice matters:** use a strong text model for JSON tasks
  (`qwen2.5:14b` was used in testing). Vision (read a plan image) needs a vision
  model (`llava`). All AI tasks use Ollama's `format: "json"` and the prompts in
  `lib/aiTasks.ts`; results are normalized (`normalizeCategory`) before applying.
- AI edits go through the same store actions as manual edits, so they're all
  **undoable**.

---

## Conventions

- **Icons:** add to `components/icons.tsx` as inline SVG (1.75 stroke). No emoji
  as UI icons, no icon library.
- **Colors:** use CSS variables (`var(--color-*)`) defined in `app/globals.css`
  for both light/dark. Canvas (Konva) colors come from `lib/themeColors.ts`
  because Konva can't read CSS vars.
- **New mutations:** add the action to the `DiagramState` interface and the store
  body; call `commit(diagram, next, set)` if it should be undoable, else
  `persist(next, set)`.
- **Verifying changes:** `npm run build` must pass. For behavior, a quick
  Playwright script against `npm run start` (production, no dev overlay) seeding
  `localStorage["bubble-diagram-v1"]` is the established pattern — install
  `playwright` as a dev dep, test, then `npm uninstall playwright` before
  committing (it is intentionally not a project dependency).
- **Commits:** descriptive messages; push to `main` → Vercel deploys.

---

## Known limitations / deferred ideas

- PDF table extraction is best-effort (PDFs have no real table structure).
- Single-user only; `localStorage` is per-browser (use Save/Load `.json` to move
  between devices).
- Not yet built: connection labels, snap-to-grid, on-canvas category headers,
  paste-at-cursor, right-click context menus, shareable read-only links / real-
  time collaboration (would need a backend, e.g. Vercel Blob), program-compliance
  check (target vs. actual area), stacking diagram, streaming AI replies.

---

## Build & verify recipe (the established pattern)

1. Make the change. Add new store actions to the `DiagramState` interface AND the
   store body.
2. `npm run build` — must pass (compile + strict TypeScript). Fix until green.
3. Behavior check in a real browser via Playwright against the **production**
   server (no dev overlay intercepting clicks):
   ```bash
   npm run build
   npm run start        # background; serves http://localhost:3000
   npm install -D playwright@1.60.0
   # write a small verify-*.mjs that seeds localStorage["bubble-diagram-v1"]
   # then drives the UI / asserts the resulting diagram JSON
   node verify-*.mjs
   npm uninstall playwright     # playwright is intentionally NOT a project dep
   ```
   - Seeding pattern: `page.evaluate(() => localStorage.setItem(
     "bubble-diagram-v1", JSON.stringify({...})))` then `page.reload()`.
   - For AI features, also seed `localStorage["bubble-diagram-ollama"]` with
     `{endpoint, model}` (use `qwen2.5:14b`); calls hit the user's real Ollama.
   - Read assertions back from `localStorage["bubble-diagram-v1"]`.
   - Take a screenshot and actually look at it before claiming success.
4. Delete the temp `verify-*.mjs` / screenshots / sample CSVs, then commit.
5. Windows: if the dev/prod server wedges or a stale `.next` causes 500s,
   `taskkill /F /IM node.exe`, `rm -rf .next`, restart.

## Deploy

- **Normal path:** `git push origin main` → Vercel auto-builds & deploys. Tell
  the user to refresh `diagrama-de-burbujas.vercel.app` in a minute or two.
- No env vars are needed (everything is client-side; AI is the user's localhost).
- `vercel` CLI is installed if you ever need `vercel logs`/`vercel deploy`, but
  it's not part of the normal flow.

## Common requests → where to start

| If the user asks… | Start in… |
|---|---|
| "add a field on bubbles" | `lib/types.ts` (Bubble), `store` updateBubble + `PropertyPanel.tsx` + `BubbleLabel.tsx` (to show it) |
| "new AI ability" | add a task to `lib/aiTasks.ts`, a store action to apply it, a button in `AiPanel.tsx` or `ChatWidget.tsx` |
| "change how bubbles are sized/placed" | `lib/bubbleLayout.ts` |
| "import / column / parsing issue" | `lib/parse*.ts`, `lib/rowClassify.ts`, `UploadPanel.tsx` |
| "export looks wrong" | `lib/exportImage.ts` |
| "new toolbar button / shortcut" | `Toolbar.tsx` (+ `icons.tsx`); global shortcuts in `app/page.tsx` |
| "new floating panel" | new component in `components/`, render it in `app/page.tsx` guarded by `hydrated` |
| "canvas interaction" | `Canvas.tsx` (modes, drag, click handlers, render layers) |
| "make it prettier / theme" | `app/globals.css` (CSS vars), `lib/themeColors.ts` for canvas |

## File-by-file index

```
app/
  page.tsx        composition + global copy/paste shortcuts + theme + fit wiring
  layout.tsx      root layout
  globals.css     CSS variable themes (light/dark), focus ring, reduced-motion
store/
  useDiagram.ts   the entire store: data + UI state + every action; undo/redo;
                  clipboard; commit() vs persist() history rule
components/        (see the component table above — 15 components)
lib/               (see the lib list above — types, parsing, AI, export, layout)
public/sample-rooms.csv   sample data
next.config.mjs    Turbopack canvas alias (do not remove)
DESIGN.md          original brainstorm + decision log
HANDOFF.md         this file
```

---

## Design doc

See `DESIGN.md` for the original brainstorming, assumptions, and decision log.
