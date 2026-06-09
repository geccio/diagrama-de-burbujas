"use client";

import { useEffect, useMemo, useRef } from "react";
import type Konva from "konva";
import { useDiagram } from "@/store/useDiagram";
import type { Mode } from "@/lib/types";
import {
  exportSheetPng,
  exportSheetPdf,
  type SheetMeta,
} from "@/lib/exportImage";
import { exportProject, importProject } from "@/lib/projectFile";
import { CATEGORIES, CATEGORY_ORDER, type CategoryId } from "@/lib/categories";
import { floorTotals, NO_FLOOR_LABEL } from "@/lib/floorTotals";
import {
  IconBubbles,
  IconCursor,
  IconLink,
  IconRuler,
  IconUpload,
  IconDownload,
  IconReset,
  IconSun,
  IconMoon,
  IconArrange,
  IconEraser,
  IconFit,
  IconUndo,
  IconRedo,
  IconSave,
  IconFolderOpen,
  IconCalibrate,
  IconMatrix,
  IconSparkles,
  IconLayers,
} from "@/components/icons";

interface Props {
  onUploadClick: () => void;
  onMatrixClick: () => void;
  onAiClick: () => void;
  stageRef: React.RefObject<Konva.Stage | null>;
}

const MODES: {
  id: Mode;
  label: string;
  Icon: typeof IconCursor;
  hint: string;
}[] = [
  { id: "select", label: "Select", Icon: IconCursor, hint: "Move & edit bubbles" },
  {
    id: "connect",
    label: "Connect",
    Icon: IconLink,
    hint: "Click two bubbles to link; click a link to remove",
  },
  {
    id: "draw",
    label: "Measure",
    Icon: IconRuler,
    hint: "Click points to measure in meters; double-click or Esc to finish",
  },
];

const iconBtn =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40";

export default function Toolbar({
  onUploadClick,
  onMatrixClick,
  onAiClick,
  stageRef,
}: Props) {
  const mode = useDiagram((s) => s.mode);
  const setMode = useDiagram((s) => s.setMode);
  const ppm = useDiagram((s) => s.diagram.pixelsPerMeter);
  const setPpm = useDiagram((s) => s.setPixelsPerMeter);
  const resetAll = useDiagram((s) => s.resetAll);
  const saving = useDiagram((s) => s.saving);
  const pendingConnectId = useDiagram((s) => s.pendingConnectId);
  const theme = useDiagram((s) => s.diagram.theme ?? "light");
  const toggleTheme = useDiagram((s) => s.toggleTheme);
  const arrangeByCategory = useDiagram((s) => s.arrangeByCategory);
  const requestFit = useDiagram((s) => s.requestFit);
  const clearDrawings = useDiagram((s) => s.clearDrawings);
  const undo = useDiagram((s) => s.undo);
  const redo = useDiagram((s) => s.redo);
  const canUndo = useDiagram((s) => s.canUndo);
  const canRedo = useDiagram((s) => s.canRedo);
  const startCalibration = useDiagram((s) => s.startCalibration);
  const floorFilter = useDiagram((s) => s.floorFilter);
  const setFloorFilter = useDiagram((s) => s.setFloorFilter);
  const diagram = useDiagram((s) => s.diagram);
  const loadDiagramObject = useDiagram((s) => s.loadDiagramObject);
  const layer = useDiagram((s) => s.activeLayer());
  const openInput = useRef<HTMLInputElement>(null);

  const hasBubbles = layer.bubbles.length > 0;
  const hasDrawings = layer.drawings.length > 0;

  // Derive floors from the layer (don't call a new-array-returning store
  // selector, which would loop). useMemo keeps the reference stable.
  const floors = useMemo(() => {
    const set = new Set<string>();
    for (const b of layer.bubbles) {
      const f = (b.floor ?? "").trim();
      if (f) set.add(f);
    }
    return Array.from(set);
  }, [layer.bubbles]);

  // If the filtered floor no longer exists (bubbles deleted/re-floored), reset
  // the filter — otherwise everything stays dimmed with no dropdown to fix it.
  useEffect(() => {
    if (floorFilter !== "__all__" && !floors.includes(floorFilter)) {
      setFloorFilter("__all__");
    }
  }, [floors, floorFilter, setFloorFilter]);

  // Keyboard shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      // Don't hijack typing in inputs.
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  function buildSheetMeta(): SheetMeta {
    const byCat = new Map<CategoryId, { area: number; count: number }>();
    let totalArea = 0;
    for (const b of layer.bubbles) {
      // Bin unknown categories (e.g. from an older/foreign .json) into "other"
      // so every bubble shows up in the totals.
      const raw = b.category ?? "other";
      const cat: CategoryId = raw in CATEGORIES ? (raw as CategoryId) : "other";
      if (!byCat.has(cat)) byCat.set(cat, { area: 0, count: 0 });
      const e = byCat.get(cat)!;
      e.count += 1;
      if (typeof b.value === "number" && isFinite(b.value) && b.value > 0) {
        e.area += b.value;
        totalArea += b.value;
      }
    }
    // Only print the floors column when at least one real floor is assigned —
    // a lone "(no floor)" row is just noise.
    const allFloors = floorTotals(layer.bubbles);
    const hasRealFloor = allFloors.some((f) => f.name !== NO_FLOOR_LABEL);
    return {
      title: "Bubble Diagram",
      date: new Date().toLocaleDateString(),
      layerName: layer.name,
      theme,
      totalArea,
      bubbleCount: layer.bubbles.length,
      categories: CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
        id: c,
        ...byCat.get(c)!,
      })),
      floors: hasRealFloor ? allFloors : [],
      hasConnections: layer.links.length > 0,
    };
  }

  async function handleExport(kind: "png" | "pdf") {
    const stage = stageRef.current;
    if (!stage) return;
    // Clear any selection so highlight rings / red link strokes aren't baked
    // into the exported image, then restore it afterwards.
    const st = useDiagram.getState();
    const sel = {
      bubble: st.selectedBubbleId,
      link: st.selectedLinkId,
      multi: st.selectedBubbleIds,
    };
    const hadSelection = sel.bubble || sel.link || sel.multi.length > 0;
    if (hadSelection) {
      st.selectBubble(null);
      await new Promise((r) => setTimeout(r, 60)); // let Konva redraw
    }
    const meta = buildSheetMeta();
    try {
      if (kind === "png") await exportSheetPng(stage, meta);
      else await exportSheetPdf(stage, meta);
    } finally {
      if (sel.bubble) st.selectBubble(sel.bubble);
      else if (sel.link) st.selectLink(sel.link);
      else if (sel.multi.length > 0) st.setMultiSelection(sel.multi);
    }
  }

  function handleSaveProject() {
    exportProject(diagram, new Date().toISOString());
  }

  async function handleOpenProject(file: File) {
    try {
      const loaded = await importProject(file);
      loadDiagramObject(loaded);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not open the project file.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <span className="font-mono-accent mr-1 flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary-hover)]">
        <IconBubbles size={18} />
        <span className="hidden sm:inline">Bubble Diagram</span>
      </span>

      {/* Mode segmented control */}
      <div
        role="radiogroup"
        aria-label="Canvas mode"
        className="flex overflow-hidden rounded-lg border border-[var(--color-border)]"
      >
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              role="radio"
              aria-checked={active}
              title={m.hint}
              onClick={() => setMode(m.id)}
              className={`flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-sm transition-colors duration-150 ${
                active
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted-fg)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
              }`}
            >
              <m.Icon size={16} />
              <span className="hidden md:inline">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Undo / redo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        className={iconBtn}
      >
        <IconUndo size={16} />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        className={iconBtn}
      >
        <IconRedo size={16} />
      </button>

      <div className="h-6 w-px bg-[var(--color-border)]" />

      <button
        onClick={onUploadClick}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-accent-hover)]"
      >
        <IconUpload size={16} />
        <span className="hidden sm:inline">Upload data</span>
      </button>
      <button
        onClick={onAiClick}
        title="AI assistant (Ollama): generate a program or suggest connections"
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)]"
      >
        <IconSparkles size={16} />
        <span className="hidden sm:inline">AI</span>
      </button>

      {/* Layout group: arrange + fit */}
      <button
        onClick={arrangeByCategory}
        disabled={!hasBubbles}
        title="Auto-arrange bubbles into clusters by category"
        aria-label="Arrange by category"
        className={iconBtn}
      >
        <IconArrange size={16} />
      </button>
      <button
        onClick={requestFit}
        disabled={!hasBubbles}
        title="Zoom to fit all bubbles"
        aria-label="Zoom to fit"
        className={iconBtn}
      >
        <IconFit size={16} />
      </button>
      <button
        onClick={clearDrawings}
        disabled={!hasDrawings}
        title="Clear all measurement lines on this layer"
        aria-label="Clear measurements"
        className={iconBtn}
      >
        <IconEraser size={16} />
      </button>
      <button
        onClick={onMatrixClick}
        disabled={!hasBubbles}
        title="View adjacency matrix"
        aria-label="Adjacency matrix"
        className={iconBtn}
      >
        <IconMatrix size={16} />
      </button>

      <div className="h-6 w-px bg-[var(--color-border)]" />

      {/* Scale */}
      <label className="flex items-center gap-1.5 text-sm text-[var(--color-muted-fg)]">
        <span className="hidden lg:inline">Scale</span>
        <input
          type="number"
          min={1}
          value={ppm}
          onChange={(e) => setPpm(Number(e.target.value))}
          aria-label="Pixels per meter"
          className="font-mono-accent w-16 cursor-text rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm text-[var(--color-fg)] transition-colors duration-150 focus:border-[var(--color-ring)]"
        />
        <span className="font-mono-accent text-xs">px/m</span>
      </label>
      <button
        onClick={startCalibration}
        title="Calibrate scale: draw a line of known real length"
        aria-label="Calibrate scale"
        className={iconBtn}
      >
        <IconCalibrate size={16} />
      </button>

      {/* Floor filter (only when bubbles have floors) */}
      {floors.length > 0 && (
        <label
          className="flex items-center gap-1.5 text-sm text-[var(--color-muted-fg)]"
          title="Show only one floor"
        >
          <IconLayers size={16} />
          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            aria-label="Floor filter"
            className="cursor-pointer rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm text-[var(--color-fg)] transition-colors duration-150 focus:border-[var(--color-ring)]"
          >
            <option value="__all__">All floors</option>
            {floors.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="h-6 w-px bg-[var(--color-border)]" />

      {/* Project file: save / open */}
      <button
        onClick={handleSaveProject}
        title="Save project to a .json file"
        aria-label="Save project"
        className={iconBtn}
      >
        <IconSave size={16} />
      </button>
      <button
        onClick={() => openInput.current?.click()}
        title="Open a .json project file"
        aria-label="Open project"
        className={iconBtn}
      >
        <IconFolderOpen size={16} />
      </button>
      <input
        ref={openInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleOpenProject(f);
          e.target.value = "";
        }}
      />

      <div className="h-6 w-px bg-[var(--color-border)]" />

      {/* Export group */}
      <button
        onClick={() => handleExport("png")}
        title="Export current view as PNG"
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)]"
      >
        <IconDownload size={16} />
        PNG
      </button>
      <button
        onClick={() => handleExport("pdf")}
        title="Export current view as PDF"
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)]"
      >
        <IconDownload size={16} />
        PDF
      </button>

      <div className="h-6 w-px bg-[var(--color-border)]" />

      <button
        onClick={toggleTheme}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        aria-label="Toggle theme"
        className={iconBtn}
      >
        {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
      </button>

      <button
        onClick={() => {
          if (confirm("Reset everything? This clears all layers and data.")) {
            resetAll();
          }
        }}
        title="Clear all layers and start fresh"
        aria-label="Reset all"
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--color-muted-fg)] transition-colors duration-150 hover:bg-[rgba(220,38,38,0.15)] hover:text-[var(--color-destructive-hover)]"
      >
        <IconReset size={16} />
      </button>

      <div className="ml-auto flex items-center gap-3 text-xs text-[var(--color-muted-fg)]">
        {mode === "connect" && (
          <span className="hidden text-[var(--color-primary-hover)] md:inline">
            {pendingConnectId
              ? "Click a second bubble to connect…"
              : "Click a bubble to start a connection"}
          </span>
        )}
        <span
          className="flex items-center gap-1.5 font-mono-accent"
          aria-live="polite"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              saving ? "bg-amber-400" : "bg-emerald-400"
            }`}
          />
          {saving ? "Saving…" : "Saved"}
        </span>
      </div>
    </div>
  );
}
