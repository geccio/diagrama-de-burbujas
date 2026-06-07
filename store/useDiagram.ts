"use client";

import { create } from "zustand";
import type { Bubble, Diagram, Drawing, Layer, Link, Mode } from "@/lib/types";
import { uid } from "@/lib/id";
import { loadDiagram, saveDiagram, clearDiagram } from "@/lib/storage";
import {
  colorForIndex,
  gridPositions,
  radiiFromValues,
  DEFAULT_RADIUS,
} from "@/lib/bubbleLayout";

function newLayer(name: string): Layer {
  return { id: uid("layer"), name, bubbles: [], links: [], drawings: [] };
}

function freshDiagram(): Diagram {
  const layer = newLayer("Layer 1");
  return { layers: [layer], activeLayerId: layer.id, pixelsPerMeter: 50 };
}

interface UIState {
  mode: Mode;
  selectedBubbleId: string | null;
  selectedLinkId: string | null;
  /** First bubble clicked while in connect mode, waiting for the second. */
  pendingConnectId: string | null;
  saving: boolean;
}

interface DiagramState extends UIState {
  diagram: Diagram;
  hydrated: boolean;

  // lifecycle
  hydrate: () => void;
  resetAll: () => void;

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

  // bubbles
  addBubblesFromRows: (
    rows: { label: string; value?: number }[],
    mode: "add" | "replace",
    canvasSize: { width: number; height: number }
  ) => void;
  addBubble: (x: number, y: number) => void;
  moveBubble: (id: string, x: number, y: number) => void;
  updateBubble: (id: string, patch: Partial<Bubble>) => void;
  deleteBubble: (id: string) => void;

  // connect mode
  handleBubbleConnectClick: (id: string) => void;
  deleteLink: (id: string) => void;

  // drawings
  addDrawing: (drawing: Drawing) => void;
  deleteDrawing: (id: string) => void;
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

export const useDiagram = create<DiagramState>((set, get) => ({
  diagram: freshDiagram(),
  hydrated: false,
  mode: "select",
  selectedBubbleId: null,
  selectedLinkId: null,
  pendingConnectId: null,
  saving: false,

  hydrate: () => {
    const stored = loadDiagram();
    if (stored) {
      set({ diagram: stored, hydrated: true });
    } else {
      set({ hydrated: true });
    }
  },

  resetAll: () => {
    clearDiagram();
    set({
      diagram: freshDiagram(),
      selectedBubbleId: null,
      selectedLinkId: null,
      pendingConnectId: null,
      mode: "select",
    });
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
    persist(next, set);
  },

  renameLayer: (id, name) => {
    const { diagram } = get();
    const next: Diagram = {
      ...diagram,
      layers: diagram.layers.map((l) => (l.id === id ? { ...l, name } : l)),
    };
    set({ diagram: next });
    persist(next, set);
  },

  deleteLayer: (id) => {
    const { diagram } = get();
    if (diagram.layers.length <= 1) return; // keep at least one layer
    const layers = diagram.layers.filter((l) => l.id !== id);
    const activeLayerId =
      diagram.activeLayerId === id ? layers[0].id : diagram.activeLayerId;
    const next: Diagram = { ...diagram, layers, activeLayerId };
    set({ diagram: next, selectedBubbleId: null, selectedLinkId: null });
    persist(next, set);
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

  addBubblesFromRows: (rows, mode, canvasSize) => {
    const { diagram } = get();
    const radii = radiiFromValues(rows.map((r) => r.value));
    const positions = gridPositions(
      rows.length,
      radii,
      canvasSize.width,
      canvasSize.height
    );
    const newBubbles: Bubble[] = rows.map((r, i) => ({
      id: uid("bubble"),
      x: positions[i].x,
      y: positions[i].y,
      radius: radii[i],
      label: r.label || "(blank)",
      value: r.value,
      color: colorForIndex(i),
    }));

    const layers = diagram.layers.map((l) => {
      if (l.id !== diagram.activeLayerId) return l;
      if (mode === "replace") {
        return { ...l, bubbles: newBubbles, links: [] };
      }
      return { ...l, bubbles: [...l.bubbles, ...newBubbles] };
    });

    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    persist(next, set);
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
      color: colorForIndex(layer.bubbles.length),
    };
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? { ...l, bubbles: [...l.bubbles, bubble] }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next, selectedBubbleId: bubble.id });
    persist(next, set);
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
    persist(next, set);
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
    persist(next, set);
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
      persist(next, set);
    } else {
      set({ pendingConnectId: null });
    }
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
    persist(next, set);
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
    persist(next, set);
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
    persist(next, set);
  },
}));
