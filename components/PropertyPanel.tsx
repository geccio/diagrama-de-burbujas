"use client";

import { useDiagram } from "@/store/useDiagram";
import { IconTrash } from "@/components/icons";

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

const cardClass =
  "absolute right-3 top-3 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xl";
const inputClass =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-fg)] transition-colors duration-150 focus:border-[var(--color-ring)]";
const dangerBtn =
  "flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--color-destructive)] px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-destructive-hover)]";

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
      <div className={cardClass}>
        <h3 className="mb-2 text-sm font-semibold">Connection selected</h3>
        <p className="mb-3 text-xs text-[var(--color-muted-fg)]">
          Remove this link to disconnect the two bubbles.
        </p>
        <button onClick={() => deleteLink(selectedLinkId)} className={dangerBtn}>
          <IconTrash size={16} />
          Delete connection
        </button>
      </div>
    );
  }

  if (!bubble) return null;

  return (
    <div className={cardClass}>
      <h3 className="mb-3 text-sm font-semibold">Bubble</h3>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-[var(--color-muted-fg)]">
          Label
        </span>
        <input
          value={bubble.label}
          onChange={(e) => updateBubble(bubble.id, { label: e.target.value })}
          className={inputClass}
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-[var(--color-muted-fg)]">
          Size (radius:{" "}
          <span className="font-mono-accent">{Math.round(bubble.radius)}px</span>
          )
        </span>
        <input
          type="range"
          min={20}
          max={130}
          value={bubble.radius}
          onChange={(e) =>
            updateBubble(bubble.id, { radius: Number(e.target.value) })
          }
          className="w-full cursor-pointer accent-[var(--color-primary)]"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-[var(--color-muted-fg)]">
          Area value (m², optional)
        </span>
        <input
          type="number"
          value={bubble.value ?? ""}
          onChange={(e) =>
            updateBubble(bubble.id, {
              value: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          className={inputClass}
        />
      </label>

      <div className="mb-4">
        <span className="mb-1.5 block text-xs text-[var(--color-muted-fg)]">
          Color
        </span>
        <div className="flex flex-wrap gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => updateBubble(bubble.id, { color: c })}
              style={{ background: c }}
              className={`h-6 w-6 cursor-pointer rounded-full ring-2 transition-transform duration-150 hover:scale-110 ${
                bubble.color === c ? "ring-white" : "ring-transparent"
              }`}
              aria-label={`Set color ${c}`}
              aria-pressed={bubble.color === c}
            />
          ))}
        </div>
      </div>

      <button onClick={() => deleteBubble(bubble.id)} className={dangerBtn}>
        <IconTrash size={16} />
        Delete bubble
      </button>
    </div>
  );
}
