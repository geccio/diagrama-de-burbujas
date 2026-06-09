"use client";

import { create } from "zustand";
import type { Bubble, Diagram, Drawing, Layer, Link, Mode } from "@/lib/types";
import { uid } from "@/lib/id";
import { loadDiagram, saveDiagram, clearDiagram } from "@/lib/storage";
import {
  gridPositions,
  radiiFromValues,
  radiusForValue,
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
  /** Multi-selected bubble ids (box-select). Empty when single/none. */
  selectedBubbleIds: string[];
  /** First bubble clicked while in connect mode, waiting for the second. */
  pendingConnectId: string | null;
  saving: boolean;
  /** Incremented to ask the Canvas to zoom-to-fit all content. */
  fitRequest: number;
  /** When true, the canvas is in 2-click scale-calibration mode. */
  calibrating: boolean;
  /** Active floor filter ("__all__" = show every floor). */
  floorFilter: string;
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
  setMultiSelection: (ids: string[]) => void;
  // bulk ops on the current multi-selection
  bulkMove: (dx: number, dy: number) => void;
  bulkSetCategory: (category: import("@/lib/categories").CategoryId) => void;
  bulkSetColor: (color: string) => void;
  bulkDelete: () => void;

  // layers
  activeLayer: () => Layer;
  addLayer: () => void;
  renameLayer: (id: string, name: string) => void;
  deleteLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;

  // scale
  setPixelsPerMeter: (ppm: number) => void;
  startCalibration: () => void;
  endCalibration: () => void;

  // theme
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // floor filter (UI-only)
  setFloorFilter: (floor: string) => void;

  // bubbles
  addBubblesFromRows: (
    rows: { label: string; value?: number }[],
    mode: "add" | "replace",
    canvasSize: { width: number; height: number }
  ) => void;
  addSpaces: (
    spaces: {
      name: string;
      area?: number;
      category?: import("@/lib/categories").CategoryId;
      floor?: string;
    }[],
    mode: "add" | "replace",
    canvasSize: { width: number; height: number }
  ) => void;
  addLinksByNames: (
    pairs: { a: string; b: string; kind?: import("@/lib/types").LinkKind }[]
  ) => void;
  applyAiEdits: (
    edits: {
      id: string;
      name?: string;
      area?: number;
      category?: import("@/lib/categories").CategoryId;
      floor?: string;
      remove?: boolean;
    }[]
  ) => number;
  applyChatActions: (
    actions: import("@/lib/aiTasks").ChatAction[],
    canvasSize: { width: number; height: number }
  ) => number;
  addBubble: (x: number, y: number) => void;
  moveBubble: (id: string, x: number, y: number) => void;
  updateBubble: (id: string, patch: Partial<Bubble>) => void;
  setBubbleCategory: (id: string, category: import("@/lib/categories").CategoryId) => void;
  deleteBubble: (id: string) => void;

  // connect mode
  handleBubbleConnectClick: (id: string) => void;
  setLinkKind: (id: string, kind: import("@/lib/types").LinkKind) => void;
  setLinkColor: (id: string, color: string | undefined) => void;
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

  // clipboard: copy / paste / duplicate bubbles (+ links between them)
  copySelection: () => number;
  pasteClipboard: () => number;
  duplicateSelection: () => number;
  hasClipboard: () => boolean;
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

// --- Clipboard (module-level; copied bubbles + links between them) ---
interface Clipboard {
  bubbles: Bubble[];
  links: Link[];
}
let clipboard: Clipboard | null = null;

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
  coalesceTag = null;
  undoStack.push(clone(prev));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  set({ canUndo: undoStack.length > 0, canRedo: false });
  persist(next, set);
}

// Coalesce rapid same-tag commits (typing in a field, dragging a slider) into
// a single undo entry: only the first change of a burst pushes history.
const COALESCE_MS = 1000;
let coalesceTag: string | null = null;
let coalesceUntil = 0;

function commitCoalesced(
  tag: string,
  prev: Diagram,
  next: Diagram,
  set: (p: Partial<DiagramState>) => void
) {
  const now = Date.now();
  if (tag === coalesceTag && now < coalesceUntil) {
    coalesceUntil = now + COALESCE_MS;
    persist(next, set);
    return;
  }
  commit(prev, next, set);
  coalesceTag = tag;
  coalesceUntil = now + COALESCE_MS;
}

function resetHistory(set: (p: Partial<DiagramState>) => void) {
  undoStack = [];
  redoStack = [];
  coalesceTag = null;
  set({ canUndo: false, canRedo: false });
}

export const useDiagram = create<DiagramState>((set, get) => ({
  diagram: freshDiagram(),
  hydrated: false,
  mode: "select",
  selectedBubbleId: null,
  selectedLinkId: null,
  selectedBubbleIds: [],
  pendingConnectId: null,
  saving: false,
  fitRequest: 0,
  calibrating: false,
  floorFilter: "__all__",
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

  selectBubble: (id) =>
    set({ selectedBubbleId: id, selectedLinkId: null, selectedBubbleIds: [] }),
  selectLink: (id) =>
    set({ selectedLinkId: id, selectedBubbleId: null, selectedBubbleIds: [] }),

  setMultiSelection: (ids) =>
    set({
      selectedBubbleIds: ids,
      selectedBubbleId: null,
      selectedLinkId: null,
    }),

  bulkMove: (dx, dy) => {
    const { diagram, selectedBubbleIds } = get();
    if (selectedBubbleIds.length === 0) return;
    const sel = new Set(selectedBubbleIds);
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? {
            ...l,
            bubbles: l.bubbles.map((b) =>
              sel.has(b.id) ? { ...b, x: b.x + dx, y: b.y + dy } : b
            ),
          }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    persist(next, set); // history handled at drag start
  },

  bulkSetCategory: (category) => {
    const { diagram, selectedBubbleIds } = get();
    if (selectedBubbleIds.length === 0) return;
    const sel = new Set(selectedBubbleIds);
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? {
            ...l,
            bubbles: l.bubbles.map((b) =>
              sel.has(b.id)
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

  bulkSetColor: (color) => {
    const { diagram, selectedBubbleIds } = get();
    if (selectedBubbleIds.length === 0) return;
    const sel = new Set(selectedBubbleIds);
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? {
            ...l,
            bubbles: l.bubbles.map((b) =>
              sel.has(b.id) ? { ...b, color } : b
            ),
          }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    commit(diagram, next, set);
  },

  bulkDelete: () => {
    const { diagram, selectedBubbleIds } = get();
    if (selectedBubbleIds.length === 0) return;
    const sel = new Set(selectedBubbleIds);
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? {
            ...l,
            bubbles: l.bubbles.filter((b) => !sel.has(b.id)),
            links: l.links.filter(
              (k) => !sel.has(k.fromBubbleId) && !sel.has(k.toBubbleId)
            ),
          }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next, selectedBubbleIds: [] });
    commit(diagram, next, set);
  },

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
      floorFilter: "__all__",
    });
    persist({ ...diagram, activeLayerId: id }, set);
  },

  setPixelsPerMeter: (ppm) => {
    const { diagram } = get();
    const next: Diagram = { ...diagram, pixelsPerMeter: Math.max(1, ppm) };
    set({ diagram: next });
    // Undoable (so undo doesn't silently lose a calibration), but coalesced
    // so typing in the scale field doesn't flood the history.
    commitCoalesced("ppm", diagram, next, set);
  },

  startCalibration: () =>
    set({
      calibrating: true,
      mode: "select",
      selectedBubbleId: null,
      selectedLinkId: null,
    }),
  endCalibration: () => set({ calibrating: false }),

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

  setFloorFilter: (floor) => set({ floorFilter: floor }),

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

  addSpaces: (spaces, mode, canvasSize) => {
    const { diagram } = get();
    const radii = radiiFromValues(spaces.map((s) => s.area));
    const positions = gridPositions(
      spaces.length,
      radii,
      canvasSize.width || 1200,
      canvasSize.height || 800
    );
    const newBubbles: Bubble[] = spaces.map((s, i) => {
      const label = s.name || "(blank)";
      const category = s.category ?? detectCategory(label);
      return {
        id: uid("bubble"),
        x: positions[i].x,
        y: positions[i].y,
        radius: radii[i],
        label,
        value: s.area,
        category,
        floor: s.floor,
        color: categoryColor(category),
      };
    });

    const layers = diagram.layers.map((l) => {
      if (l.id !== diagram.activeLayerId) return l;
      if (mode === "replace") {
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
    set((s) => ({ fitRequest: s.fitRequest + 1 }));
  },

  addLinksByNames: (pairs) => {
    const { diagram } = get();
    const layer = get().activeLayer();
    // name (lowercased) -> bubble id
    const idByName = new Map<string, string>();
    for (const b of layer.bubbles) {
      idByName.set(b.label.toLowerCase().trim(), b.id);
    }
    const existing = new Set(
      layer.links.map((k) => [k.fromBubbleId, k.toBubbleId].sort().join("|"))
    );
    const newLinks: Link[] = [];
    for (const p of pairs) {
      const fromId = idByName.get(p.a?.toLowerCase().trim() ?? "");
      const toId = idByName.get(p.b?.toLowerCase().trim() ?? "");
      if (!fromId || !toId || fromId === toId) continue;
      const key = [fromId, toId].sort().join("|");
      if (existing.has(key)) continue;
      existing.add(key);
      newLinks.push({
        id: uid("link"),
        fromBubbleId: fromId,
        toBubbleId: toId,
        kind: p.kind ?? "solid",
      });
    }
    if (newLinks.length === 0) return;
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? { ...l, links: [...l.links, ...newLinks] }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    commit(diagram, next, set);
  },

  applyAiEdits: (edits) => {
    const { diagram } = get();
    const editById = new Map(edits.map((e) => [e.id, e]));
    let changed = 0;

    const layers = diagram.layers.map((l) => {
      if (l.id !== diagram.activeLayerId) return l;
      const removeIds = new Set(
        edits.filter((e) => e.remove).map((e) => e.id)
      );
      const bubbles = l.bubbles
        .filter((b) => {
          if (removeIds.has(b.id)) {
            changed++;
            return false;
          }
          return true;
        })
        .map((b) => {
          const e = editById.get(b.id);
          if (!e || e.remove) return b;
          const patch: Partial<Bubble> = {};
          if (typeof e.name === "string" && e.name.trim() && e.name !== b.label)
            patch.label = e.name;
          if (
            typeof e.area === "number" &&
            isFinite(e.area) &&
            e.area !== b.value
          ) {
            patch.value = e.area;
            patch.radius = radiusForValue(e.area);
          }
          if (e.category && e.category !== b.category) {
            patch.category = e.category;
            patch.color = categoryColor(e.category);
          }
          if (typeof e.floor === "string" && e.floor !== b.floor)
            patch.floor = e.floor || undefined;
          if (Object.keys(patch).length === 0) return b;
          changed++;
          return { ...b, ...patch };
        });
      // Drop links touching removed bubbles.
      const links = l.links.filter(
        (k) => !removeIds.has(k.fromBubbleId) && !removeIds.has(k.toBubbleId)
      );
      return { ...l, bubbles, links };
    });

    if (changed === 0) return 0;
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next, selectedBubbleId: null, selectedLinkId: null });
    commit(diagram, next, set);
    return changed;
  },

  applyChatActions: (actions, canvasSize) => {
    if (!actions || actions.length === 0) return 0;
    const { diagram } = get();
    const layer = get().activeLayer();
    let bubbles = [...layer.bubbles];
    let links = [...layer.links];
    let changed = 0;

    // Spawn new bubbles in a small grid offset from existing content.
    const creates = actions.filter((a) => a.op === "create");
    if (creates.length) {
      const radii = radiiFromValues(creates.map((c) => c.area));
      const positions = gridPositions(
        creates.length,
        radii,
        canvasSize.width || 1200,
        canvasSize.height || 800
      );
      creates.forEach((c, i) => {
        const label = c.name || "New";
        const category = c.category ?? detectCategory(label);
        bubbles.push({
          id: uid("bubble"),
          x: positions[i].x,
          y: positions[i].y,
          radius: radii[i],
          label,
          value: c.area,
          category,
          floor: c.floor,
          color: categoryColor(category),
        });
        changed++;
      });
    }

    // Edits + deletes by id.
    for (const a of actions) {
      if (a.op === "delete" && a.id) {
        const before = bubbles.length;
        bubbles = bubbles.filter((b) => b.id !== a.id);
        links = links.filter(
          (k) => k.fromBubbleId !== a.id && k.toBubbleId !== a.id
        );
        if (bubbles.length !== before) changed++;
      } else if (a.op === "edit" && a.id) {
        bubbles = bubbles.map((b) => {
          if (b.id !== a.id) return b;
          const patch: Partial<Bubble> = {};
          if (a.name && a.name !== b.label) patch.label = a.name;
          if (typeof a.area === "number" && a.area !== b.value) {
            patch.value = a.area;
            patch.radius = radiusForValue(a.area);
          }
          if (a.category && a.category !== b.category) {
            patch.category = a.category;
            patch.color = categoryColor(a.category);
          }
          if (typeof a.floor === "string" && a.floor !== b.floor)
            patch.floor = a.floor || undefined;
          if (Object.keys(patch).length) changed++;
          return { ...b, ...patch };
        });
      }
    }

    // Links by name (resolved against the updated bubble set).
    const idByName = new Map<string, string>();
    for (const b of bubbles) idByName.set(b.label.toLowerCase().trim(), b.id);
    const existing = new Set(
      links.map((k) => [k.fromBubbleId, k.toBubbleId].sort().join("|"))
    );
    for (const a of actions) {
      if (a.op !== "link") continue;
      const fromId = idByName.get(a.a?.toLowerCase().trim() ?? "");
      const toId = idByName.get(a.b?.toLowerCase().trim() ?? "");
      if (!fromId || !toId || fromId === toId) continue;
      const key = [fromId, toId].sort().join("|");
      if (existing.has(key)) continue;
      existing.add(key);
      links.push({
        id: uid("link"),
        fromBubbleId: fromId,
        toBubbleId: toId,
        kind: a.kind ?? "solid",
      });
      changed++;
    }

    if (changed === 0) return 0;
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId ? { ...l, bubbles, links } : l
    );
    const next: Diagram = { ...diagram, layers };
    set({ diagram: next });
    commit(diagram, next, set);
    return changed;
  },

  addBubble: (x, y) => {
    const { diagram } = get();
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
    // Coalesce per-keystroke / per-slider-tick updates into one undo entry.
    commitCoalesced(
      `bubble:${id}:${Object.keys(patch).sort().join(",")}`,
      diagram,
      next,
      set
    );
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

  setLinkColor: (id, color) => {
    const { diagram } = get();
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? {
            ...l,
            links: l.links.map((k) => (k.id === id ? { ...k, color } : k)),
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
    // Undoable, but coalesced: an opacity-slider drag is one history entry.
    commitCoalesced("background", diagram, next, set);
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
    coalesceTag = null;
    undoStack.push(clone(diagram));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
    set({ canUndo: true, canRedo: false });
  },

  undo: () => {
    const prev = undoStack.pop();
    if (!prev) return;
    const { diagram } = get();
    coalesceTag = null;
    redoStack.push(clone(diagram));
    set({
      diagram: prev,
      selectedBubbleId: null,
      selectedLinkId: null,
      selectedBubbleIds: [],
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
    coalesceTag = null;
    undoStack.push(clone(diagram));
    set({
      diagram: next,
      selectedBubbleId: null,
      selectedLinkId: null,
      selectedBubbleIds: [],
      pendingConnectId: null,
      canUndo: true,
      canRedo: redoStack.length > 0,
    });
    persist(next, set);
  },

  // --- clipboard ---
  hasClipboard: () => clipboard !== null && clipboard.bubbles.length > 0,

  copySelection: () => {
    const { selectedBubbleId, selectedBubbleIds } = get();
    const layer = get().activeLayer();
    const ids = new Set(
      selectedBubbleIds.length > 0
        ? selectedBubbleIds
        : selectedBubbleId
        ? [selectedBubbleId]
        : []
    );
    if (ids.size === 0) return 0;
    const bubbles = layer.bubbles.filter((b) => ids.has(b.id));
    // Keep only links whose BOTH ends are in the copied set.
    const links = layer.links.filter(
      (k) => ids.has(k.fromBubbleId) && ids.has(k.toBubbleId)
    );
    // Deep-copy so later edits to the originals don't mutate the clipboard.
    clipboard = JSON.parse(JSON.stringify({ bubbles, links })) as Clipboard;
    return bubbles.length;
  },

  duplicateSelection: () => {
    // Duplicate via a temporary copy WITHOUT touching the user's clipboard:
    // no selection = no-op (never paste stale content), and a later Ctrl+V
    // still pastes what the user explicitly copied.
    const saved = clipboard;
    if (get().copySelection() === 0) return 0;
    const count = get().pasteClipboard();
    clipboard = saved;
    return count;
  },

  pasteClipboard: () => {
    if (!clipboard || clipboard.bubbles.length === 0) return 0;
    const { diagram } = get();
    const OFFSET = 40;
    // Fresh ids; remap so internal links reconnect to the new bubbles.
    const idMap = new Map<string, string>();
    const newBubbles: Bubble[] = clipboard.bubbles.map((b) => {
      const nid = uid("bubble");
      idMap.set(b.id, nid);
      return { ...b, id: nid, x: b.x + OFFSET, y: b.y + OFFSET };
    });
    const newLinks: Link[] = clipboard.links.map((k) => ({
      ...k,
      id: uid("link"),
      fromBubbleId: idMap.get(k.fromBubbleId)!,
      toBubbleId: idMap.get(k.toBubbleId)!,
    }));
    const layers = diagram.layers.map((l) =>
      l.id === diagram.activeLayerId
        ? {
            ...l,
            bubbles: [...l.bubbles, ...newBubbles],
            links: [...l.links, ...newLinks],
          }
        : l
    );
    const next: Diagram = { ...diagram, layers };
    set({
      diagram: next,
      selectedBubbleId: newBubbles.length === 1 ? newBubbles[0].id : null,
      selectedBubbleIds: newBubbles.length > 1 ? newBubbles.map((b) => b.id) : [],
      selectedLinkId: null,
    });
    commit(diagram, next, set);
    return newBubbles.length;
  },
}));
