"use client";

import { useDiagram } from "@/store/useDiagram";
import { IconTrash, IconCopy } from "@/components/icons";
import { CATEGORIES, CATEGORY_ORDER, type CategoryId } from "@/lib/categories";
import { radiusForValue } from "@/lib/bubbleLayout";

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

// Positioned by the right-side panel column in page.tsx.
const cardClass =
  "pointer-events-auto w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xl";
const inputClass =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-fg)] transition-colors duration-150 focus:border-[var(--color-ring)]";
const dangerBtn =
  "flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--color-destructive)] px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-destructive-hover)]";

export default function PropertyPanel() {
  const layer = useDiagram((s) => s.activeLayer());
  const selectedBubbleId = useDiagram((s) => s.selectedBubbleId);
  const selectedLinkId = useDiagram((s) => s.selectedLinkId);
  const updateBubble = useDiagram((s) => s.updateBubble);
  const setBubbleCategory = useDiagram((s) => s.setBubbleCategory);
  const setLinkKind = useDiagram((s) => s.setLinkKind);
  const setLinkColor = useDiagram((s) => s.setLinkColor);
  const deleteBubble = useDiagram((s) => s.deleteBubble);
  const deleteLink = useDiagram((s) => s.deleteLink);
  const duplicateSelection = useDiagram((s) => s.duplicateSelection);

  const bubble = layer.bubbles.find((b) => b.id === selectedBubbleId);
  const link = layer.links.find((k) => k.id === selectedLinkId);

  if (selectedLinkId && link) {
    const kind = link.kind ?? "solid";
    return (
      <div className={cardClass}>
        <h3 className="mb-3 text-sm font-semibold">Connection</h3>

        <span className="mb-1.5 block text-xs text-[var(--color-muted-fg)]">
          Relationship type
        </span>
        <div className="mb-4 flex overflow-hidden rounded-lg border border-[var(--color-border)]">
          <button
            onClick={() => setLinkKind(selectedLinkId, "solid")}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 px-3 py-2 text-sm transition-colors duration-150 ${
              kind === "solid"
                ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                : "bg-[var(--color-surface-2)] text-[var(--color-muted-fg)] hover:text-[var(--color-fg)]"
            }`}
          >
            <svg width="26" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="26" y2="4" stroke="currentColor" strokeWidth="2.5" />
            </svg>
            Sure
          </button>
          <button
            onClick={() => setLinkKind(selectedLinkId, "dashed")}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 px-3 py-2 text-sm transition-colors duration-150 ${
              kind === "dashed"
                ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                : "bg-[var(--color-surface-2)] text-[var(--color-muted-fg)] hover:text-[var(--color-fg)]"
            }`}
          >
            <svg width="26" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="26"
                y2="4"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="5 4"
              />
            </svg>
            Not sure
          </button>
        </div>
        <p className="mb-4 text-xs text-[var(--color-muted-fg)]">
          {kind === "dashed"
            ? "Dashed = intermittent / uncertain relationship."
            : "Solid = sure / direct relationship."}
        </p>

        <div className="mb-4">
          <span className="mb-1.5 block text-xs text-[var(--color-muted-fg)]">
            Line color
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setLinkColor(selectedLinkId, undefined)}
              title="Default (theme color)"
              className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[10px] font-medium text-[var(--color-muted-fg)] ring-2 transition-transform duration-150 hover:scale-110 ${
                !link.color ? "ring-white" : "ring-transparent"
              }`}
              aria-label="Default line color"
              aria-pressed={!link.color}
            >
              A
            </button>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setLinkColor(selectedLinkId, c)}
                style={{ background: c }}
                className={`h-6 w-6 cursor-pointer rounded-full ring-2 transition-transform duration-150 hover:scale-110 ${
                  link.color === c ? "ring-white" : "ring-transparent"
                }`}
                aria-label={`Set line color ${c}`}
                aria-pressed={link.color === c}
              />
            ))}
          </div>
        </div>

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
          Area value (m²) — resizes the bubble
        </span>
        <input
          type="number"
          min={0}
          step="0.5"
          value={bubble.value ?? ""}
          onChange={(e) => {
            if (e.target.value === "") {
              updateBubble(bubble.id, { value: undefined });
              return;
            }
            const value = Number(e.target.value);
            // Keep circle area proportional to the entered value.
            updateBubble(bubble.id, { value, radius: radiusForValue(value) });
          }}
          className={inputClass}
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-[var(--color-muted-fg)]">
          Floor / level (optional)
        </span>
        <input
          value={bubble.floor ?? ""}
          onChange={(e) =>
            updateBubble(bubble.id, {
              floor: e.target.value || undefined,
            })
          }
          placeholder="e.g. Ground, P2"
          className={inputClass}
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-[var(--color-muted-fg)]">
          Category
        </span>
        <select
          value={bubble.category ?? "other"}
          onChange={(e) =>
            setBubbleCategory(bubble.id, e.target.value as CategoryId)
          }
          className="w-full cursor-pointer rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-fg)] transition-colors duration-150 focus:border-[var(--color-ring)]"
        >
          {CATEGORY_ORDER.map((id) => (
            <option key={id} value={id}>
              {CATEGORIES[id].label}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-4">
        <span className="mb-1.5 block text-xs text-[var(--color-muted-fg)]">
          Color <span className="opacity-60">(overrides category)</span>
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

      <button
        onClick={() => duplicateSelection()}
        title="Duplicate (Ctrl+D)"
        className="mb-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)]"
      >
        <IconCopy size={16} />
        Duplicate
      </button>

      <button onClick={() => deleteBubble(bubble.id)} className={dangerBtn}>
        <IconTrash size={16} />
        Delete bubble
      </button>
    </div>
  );
}
