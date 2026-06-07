"use client";

import { create } from "zustand";
import type { Bubble, Diagram, Drawing, Layer, Link, Mode } from "@/lib/types";
import { uid } from "@/lib/id";
import { loadDiagram, saveDiagram, clearDiagram } from "@/lib/storage";
import {
  gridPositions,
  radiiFromValues,
  clusterByCategory,
  DEFAULT_RADIUS,
} from "@/lib/bubbleLayout";
import { detectCategory, categoryColor } from "@/lib/categories";
import type { Theme } from "@/lib/types";

function newLayer(name: string): Layer {
  return { id: uid("layer"), name, bubbles: [], links: [], drawings: [] };
}

function freshDiagram(): Diagram {
  const layer = newLayer("Layer 1");
  return {
    layers: [layer],
    activeLayerId: layer.id,
    pixelsPerMeter: 50,
    theme: "light",
  };
}

interface UIState {
  mode: Mode;
  selectedBubbleId: string | null;
  selectedLinkId: string | null;
  /** First bubble clicked while in connect mode, waiting for the second. */
  pendingConnectId: string | null;
  saving: boolean;
  /** Incremented to ask the Canvas to zoom-to-fit all content. */
  fitRequest: number;
  /** Undo/redo availability (counts) for the UI. */
  canUndo: boolean;
  canRedo: boolean;
}

interface DiagramState extends UIState {
  diagram: Diagram;
  hydrated: boolean;

  // lifecycle
  hydrate: () => void;
  resetAll: () => void;
  loadDiagramObject: (diagram: Diagram) => void;

  // ui
  setMode: (mode: Mode) => void;
  selectBubble: (id: string | null) => void;
  selectLink: (id: string | null) => void;

  // layers
  activeLayer: () => Layer;
  addLayer: () => void;
  renameLayer: (id: string, name: string) => void;
  deleteLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;

  // scale
  setPixelsPerMeter: (ppm: number) => void;

  // theme
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // bubbles
  addBubblesFromRows: (
    rows: { label: string; value?: number }[],
    mode: "add" | "replace",
    canvasSize: { width: number; height: number }
  ) => void;
  addBubble: (x: number, y: number) => void;
  moveBubble: (id: string, x: number, y: number) => void;
  updateBubble: (id: string, patch: Partial<Bubble>) => void;
  setBubbleCategory: (id: string, category: import("@/lib/categories").CategoryId) => void;
  deleteBubble: (id: string) => void;

  // connect mode
  handleBubbleConnectClick: (id: string) => void;
  setLinkKind: (id: string, kind: import("@/lib/types").LinkKind) => void;
  deleteLink: (id: string) => void;

  // drawings
  addDrawing: (drawing: Drawing) => void;
  deleteDrawing: (id: string) => void;
  clearDrawings: () => void;

  // background image (per active layer)
  setBackground: (src: string, naturalW: number, naturalH: number) => void;
  updateBackground: (
    patch: Partial<import("@/lib/types").Background>
  ) => void;
  removeBackground: () => void;

  // layout
  arrangeByCategory: () => void;
  requestFit: () => void;

  // undo / redo
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

/** Persist the diagram to localStorage (debounced). */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist(diagram: Diagram, set: (p: Partial<DiagramState>) => void) {
  set({ saving: true });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDiagram(diagram);
    set({ saving: false });
  }, 400);
}

// --- Undo / redo history (module-level stacks; not part of persisted state) ---
const MAX_HISTORY = 60;
let undoStack: Diagram[] = [];
let redoStack: Diagram[] = [];

function clone(d: Diagram): Diagram {
  return JSON.parse(JSON.stringify(d));
}

/**
 * Record `prev` (state before the change), persist `next`, and clear the redo
 * stack. Used by every mutating action so undo/redo "just works".
 */
function commit(
  prev: Diagram,
  next: Diagram,
  set: (p: Partial<DiagramState>) => void
) {
  undoStack.push(clone(prev));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  set({ canUndo: undoStack.length > 0, canRedo: false });
  persist(next, set);
}

function resetHistory(set: (p: Partial<DiagramState>) => void) {
  undoStack = [];
  redoStack = [];
  set({ canUndo: false, canRedo: false });
}

export const useDiagram = create<DiagramState>((set, get) => ({
  diagram: freshDiagram(),
  hydrated: false,
  mode: "select",
  selectedBubbleId: null,
  selectedLinkId: null,
  pendingConnectId: null,
  saving: false,
  fitRequest: 0,
  canUndo: false,
  canRedo: false,

  hydrate: () => {
    const stored = loadDiagram();
    resetHistory(set);
    if (stored) {
      set({ diagram: stored, hydrated: true });
    } else {
      set({ hydrated: true });
    }
  },

  resetAll: () => {
    clearDiagram();
    resetHistory(set);
    set({
      diagram: freshDiagram(),
      selectedBubbleId: null,
      selectedLinkId: null,
      pendingConnectId: null,
      mode: "select",
    });
  },

  loadDiagramObject: (diagram) => {
    resetHistory(set);
    set({
      diagram,
      selectedBubbleId: null,
      selectedLinkId: null,
      pendingConnectId: null,
      mode: "select",
    });
    persist(diagram, set);
    set((s) => ({ fitRequest: s.fitRequest + 1 }));
  },

  setMode: (mode) =>
    set({
      mode,
      pendingConnectId: null,
      selectedBubbleId: mode === "select" ? get().selectedBubbleId : null,
      selectedLinkId: null,
    }),

  selectBubble: (id) => set({ selectedBubbleId: id, selectedLinkId: null }),
  selectLink: (id) => set({ selectedLinkId: id, selectedBubbleId: null }),

  activeLayer: () => {
    const { diagram } = get();
    return (
      diagram.layers.find((l) => l.id === diagram.activeLayerId) ??
      diagram.layers[0]
    );
  },

  addLayer: () => {
    const { diagram } = get();
    const layer = newLayer(`Layer ${diagram.layers.length + 1}`);
    const next: Diagram = {
      ...diagram,
      layers: [...diagram.layers, layer],
      activeLayerId: layer.id,
    };
    set({ diagram: next, selectedBubbleId: null, selectedLinkId: null });
    commit(diagram, next, set);
  },

  renameLayer: (id, name) => {
    const { diagram } = get();
    const next: Diagram = {
      ...diagram,
      layers: diagram.layers.map((l) => (l.id === id ? { ...l, name } : l)),
    };
    set({ diagram: next });
    commit(diagram, next, set);
  },

  deleteLayer: (id) => {
    const { diagram } = get();
    if (diagram.layers.length <= 1) return; // keep at least one layer
    const layers = diagram.layers.filter((l) => l.id !== id);
    const activeLayerId =
      diagram.activeLayerId === id ? layers[0].id : diagram.activeLayerId;
    const next: Diagram = { ...diagram, layers, activeLayerId };
    set({ diagram: next, selectedBubbleId: null, selectedLinkId: null });
    commit(diagram, next, set);
  },

  setActiveLayer: (id) => {
    const { diagram } = get();
    set({
      diagram: { ...diagram, activeLayerId: id },
      selectedBubbleId: null,
      selectedLinkId: null,
      pendingConnectId: null,
    });
    persist({ ...diagram, activeLayerId: id }, set);
  },

  setPixelsPerMeter: (ppm) => {
    const { diagram } = get();
    const next: Diagram = { ...diagram, pixelsPerMeter: Math.max(1, ppm) };
    set({ diagram: next });
    persist(next, set);
  },

  setTheme: (theme) => {
    const { diagram } = get();
    const next: Diagram = { ...diagram, theme };
    set({ diagram: next });
    persist(next, set);
  },

  toggleTheme: () => {
    const { diagram } = get();
    const theme: Theme = diagram.theme === "dark" ? "light" : "dark";
    const next: Diagram = { ...diagram, theme };
    set({ diagram: next });
    persist(next, set);
  },

  addBubblesFromRows: (rows, mode, canvasSize) => {
    const { diagram } = get();
    const radii = radiiFromValues(rows.map((r) => r.value));
    const positions = gridPositions(
      rows.length,
      radii,
      canvasSize.width,
      canvasSize.height
    );
    const newBubbles: Bubble[] = rows.map((r, i) => {
      const label = r.label || "(blank)";
      const category = detectCategory(label);
      return {
        id: uid("bubble"),
        x: positions[i].x,
        y: positions[i].y,
        radius: radii[i],
        label,
        value: r.value,
        category,
        color: categoryColor(category),
      };
    });

    const layers = diagram.layers.map((l) => {
      if (l.id !== diagram.activeLayerId) return l;
      if (mode === "replace") {
        // Lay the fresh set out in clean category clusters.
        const clustered = clusterByCategory(newBubbles);
        const byId = new Map(clustered.map((p) => [p.id, p]));
        const arranged = newBubbles.map((b) => {
          const p = byId.get(b.id);
          return p ? { ...b, x: p.x, y: p.y } : b;
        });
        return { ...l, bubbles: arranged, links: [] };
      }
      return { ...l, bubbles: [...l.bubbles, ...newBubbles] };
    });

    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    commit(diagram, next, set);
    // Frame the new content.
    set((s) => ({ fitRequest: s.fitRequest + 1 }));
  },

  addBubble: (x, y) => {
    const { diagram } = get();
    const layer = get().activeLayer();
    const bubble: Bubble = {
      id: uid("bubble"),
      x,
      y,
      radius: DEFAULT_RADIUS,
      label: "New",
      category: "other",
      color: categoryColor("other"),
    };
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? { ...l, bubbles: [...l.bubbles, bubble] }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next, selectedBubbleId: bubble.id });
    commit(diagram, next, set);
  },

  moveBubble: (id, x, y) => {
    const { diagram } = get();
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? {
            ...l,
            bubbles: l.bubbles.map((b) => (b.id === id ? { ...b, x, y } : b)),
          }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    persist(next, set);
  },

  updateBubble: (id, patch) => {
    const { diagram } = get();
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? {
            ...l,
            bubbles: l.bubbles.map((b) =>
              b.id === id ? { ...b, ...patch } : b
            ),
          }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    commit(diagram, next, set);
  },

  setBubbleCategory: (id, category) => {
    const { diagram } = get();
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? {
            ...l,
            bubbles: l.bubbles.map((b) =>
              b.id === id
                ? { ...b, category, color: categoryColor(category) }
                : b
            ),
          }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    commit(diagram, next, set);
  },

  deleteBubble: (id) => {
    const { diagram } = get();
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? {
            ...l,
            bubbles: l.bubbles.filter((b) => b.id !== id),
            links: l.links.filter(
              (k) => k.fromBubbleId !== id && k.toBubbleId !== id
            ),
          }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next, selectedBubbleId: null });
    commit(diagram, next, set);
  },

  handleBubbleConnectClick: (id) => {
    const { pendingConnectId, diagram } = get();
    if (!pendingConnectId) {
      set({ pendingConnectId: id });
      return;
    }
    if (pendingConnectId === id) {
      set({ pendingConnectId: null }); // clicked same bubble -> cancel
      return;
    }
    // Avoid duplicate links (in either direction).
    const layer = get().activeLayer();
    const exists = layer.links.some(
      (k) =>
        (k.fromBubbleId === pendingConnectId && k.toBubbleId === id) ||
        (k.fromBubbleId === id && k.toBubbleId === pendingConnectId)
    );
    if (!exists) {
      const link: Link = {
        id: uid("link"),
        fromBubbleId: pendingConnectId,
        toBubbleId: id,
      };
      const layers = diagram.layers.map((l) =>
        l.id === diagram.activeLayerId
          ? { ...l, links: [...l.links, link] }
          : l
      );
      const next: Diagram = { ...diagram, layers };
      set({ diagram: next, pendingConnectId: null });
      commit(diagram, next, set);
    } else {
      set({ pendingConnectId: null });
    }
  },

  setLinkKind: (id, kind) => {
    const { diagram } = get();
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? {
            ...l,
            links: l.links.map((k) => (k.id === id ? { ...k, kind } : k)),
          }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    commit(diagram, next, set);
  },

  deleteLink: (id) => {
    const { diagram } = get();
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? { ...l, links: l.links.filter((k) => k.id !== id) }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next, selectedLinkId: null });
    commit(diagram, next, set);
  },

  addDrawing: (drawing) => {
    const { diagram } = get();
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? { ...l, drawings: [...l.drawings, drawing] }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    commit(diagram, next, set);
  },

  deleteDrawing: (id) => {
    const { diagram } = get();
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? { ...l, drawings: l.drawings.filter((d) => d.id !== id) }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    commit(diagram, next, set);
  },

  clearDrawings: () => {
    const { diagram } = get();
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId ? { ...l, drawings: [] } : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    commit(diagram, next, set);
  },

  setBackground: (src, naturalW, naturalH) => {
    const { diagram } = get();
    // Fit the image to a reasonable on-canvas size while keeping aspect ratio.
    const maxDim = 1000;
    const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
    const width = Math.round(naturalW * scale);
    const height = Math.round(naturalH * scale);
    const background = {
      src,
      x: 80,
      y: 80,
      width,
      height,
      opacity: 0.55,
      locked: false,
    };
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId ? { ...l, background } : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    commit(diagram, next, set);
    set((s) => ({ fitRequest: s.fitRequest + 1 }));
  },

  updateBackground: (patch) => {
    const { diagram } = get();
    const layers = diagram.layers.map((l) => {
      if (l.id !== diagram.activeLayerId || !l.background) return l;
      return { ...l, background: { ...l.background, ...patch } };
    });
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    persist(next, set); // opacity/move are fine-grained; keep out of history flood
  },

  removeBackground: () => {
    const { diagram } = get();
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId ? { ...l, background: undefined } : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    commit(diagram, next, set);
  },

  arrangeByCategory: () => {
    const { diagram } = get();
    const layer = get().activeLayer();
    const positions = clusterByCategory(layer.bubbles);
    const posById = new Map(positions.map((p) => [p.id, p]));
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? {
            ...l,
            bubbles: l.bubbles.map((b) => {
              const p = posById.get(b.id);
              return p ? { ...b, x: p.x, y: p.y } : b;
            }),
          }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next, selectedBubbleId: null, selectedLinkId: null });
    commit(diagram, next, set);
    // Re-frame the new arrangement on the next tick.
    set((s) => ({ fitRequest: s.fitRequest + 1 }));
  },

  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),

  // --- undo / redo + drag history ---
  pushHistory: () => {
    const { diagram } = get();
    undoStack.push(clone(diagram));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
    set({ canUndo: true, canRedo: false });
  },

  undo: () => {
    const prev = undoStack.pop();
    if (!prev) return;
    const { diagram } = get();
    redoStack.push(clone(diagram));
    set({
      diagram: prev,
      selectedBubbleId: null,
      selectedLinkId: null,
      pendingConnectId: null,
      canUndo: undoStack.length > 0,
      canRedo: true,
    });
    persist(prev, set);
  },

  redo: () => {
    const next = redoStack.pop();
    if (!next) return;
    const { diagram } = get();
    undoStack.push(clone(diagram));
    set({
      diagram: next,
      selectedBubbleId: null,
      selectedLinkId: null,
      pendingConnectId: null,
      canUndo: true,
      canRedo: redoStack.length > 0,
    });
    persist(next, set);
  },
}));
