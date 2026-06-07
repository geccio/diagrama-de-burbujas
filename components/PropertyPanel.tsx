"use client";

import { useDiagram } from "@/store/useDiagram";

const COLORS = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#f472b6",
  "#22d3ee",
  "#fb923c",
  "#a3e635",
  "#c084fc",
];

export default function PropertyPanel() {
  const layer = useDiagram((s) => s.activeLayer());
  const selectedBubbleId = useDiagram((s) => s.selectedBubbleId);
  const selectedLinkId = useDiagram((s) => s.selectedLinkId);
  const updateBubble = useDiagram((s) => s.updateBubble);
  const deleteBubble = useDiagram((s) => s.deleteBubble);
  const deleteLink = useDiagram((s) => s.deleteLink);

  const bubble = layer.bubbles.find((b) => b.id === selectedBubbleId);

  if (selectedLinkId) {
    return (
      <div className="absolute right-3 top-3 w-64 rounded-lg bg-slate-800 p-4 shadow-xl ring-1 ring-slate-700">
        <h3 className="mb-2 text-sm font-semibold">Connection selected</h3>
        <p className="mb-3 text-xs text-slate-400">
          Remove this link to disconnect the two bubbles.
        </p>
        <button
          onClick={() => deleteLink(selectedLinkId)}
          className="w-full rounded bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500"
        >
          Delete connection
        </button>
      </div>
    );
  }

  if (!bubble) return null;

  return (
    <div className="absolute right-3 top-3 w-64 rounded-lg bg-slate-800 p-4 shadow-xl ring-1 ring-slate-700">
      <h3 className="mb-3 text-sm font-semibold">Bubble</h3>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-slate-400">Label</span>
        <input
          value={bubble.label}
          onChange={(e) => updateBubble(bubble.id, { label: e.target.value })}
          className="w-full rounded bg-slate-900 px-2 py-1.5 text-sm ring-1 ring-slate-600 focus:ring-blue-400"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-slate-400">
          Size (radius: {Math.round(bubble.radius)} px)
        </span>
        <input
          type="range"
          min={20}
          max={130}
          value={bubble.radius}
          onChange={(e) =>
            updateBubble(bubble.id, { radius: Number(e.target.value) })
          }
          className="w-full"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-slate-400">
          Area value (m², optional)
        </span>
        <input
          type="number"
          value={bubble.value ?? ""}
          onChange={(e) =>
            updateBubble(bubble.id, {
              value:
                e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          className="w-full rounded bg-slate-900 px-2 py-1.5 text-sm ring-1 ring-slate-600 focus:ring-blue-400"
        />
      </label>

      <div className="mb-4">
        <span className="mb-1 block text-xs text-slate-400">Color</span>
        <div className="flex flex-wrap gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => updateBubble(bubble.id, { color: c })}
              style={{ background: c }}
              className={`h-6 w-6 rounded-full ring-2 ${
                bubble.color === c ? "ring-white" : "ring-transparent"
              }`}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </div>

      <button
        onClick={() => deleteBubble(bubble.id)}
        className="w-full rounded bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500"
      >
        Delete bubble
      </button>
    </div>
  );
}
