"use client";

import { useDiagram } from "@/store/useDiagram";
import { CATEGORIES, CATEGORY_ORDER, type CategoryId } from "@/lib/categories";
import { IconTrash, IconX } from "@/components/icons";

const COLORS = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#f472b6",
  "#22d3ee",
  "#fb923c",
];

/**
 * Floating bar shown when 2+ bubbles are box-selected (Shift+drag). Bulk
 * re-categorize, recolor, or delete the whole selection.
 */
export default function MultiSelectBar() {
  const selectedBubbleIds = useDiagram((s) => s.selectedBubbleIds);
  const bulkSetCategory = useDiagram((s) => s.bulkSetCategory);
  const bulkSetColor = useDiagram((s) => s.bulkSetColor);
  const bulkDelete = useDiagram((s) => s.bulkDelete);
  const setMultiSelection = useDiagram((s) => s.setMultiSelection);

  if (selectedBubbleIds.length < 2) return null;

  return (
    <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-3 py-2 shadow-xl backdrop-blur">
      <span className="font-mono-accent text-sm font-semibold text-[var(--color-fg)]">
        {selectedBubbleIds.length} selected
      </span>

      <div className="h-5 w-px bg-[var(--color-border)]" />

      <span className="text-xs text-[var(--color-muted-fg)]">Category</span>
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value)
            bulkSetCategory(e.target.value as CategoryId);
          e.target.value = "";
        }}
        className="cursor-pointer rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm text-[var(--color-fg)] focus:border-[var(--color-ring)]"
      >
        <option value="" disabled>
          Set…
        </option>
        {CATEGORY_ORDER.map((id) => (
          <option key={id} value={id}>
            {CATEGORIES[id].label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => bulkSetColor(c)}
            style={{ background: c }}
            className="h-5 w-5 cursor-pointer rounded-full ring-1 ring-[var(--color-border)] transition-transform duration-150 hover:scale-110"
            aria-label={`Set color ${c}`}
          />
        ))}
      </div>

      <div className="h-5 w-px bg-[var(--color-border)]" />

      <button
        onClick={bulkDelete}
        className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-sm text-[var(--color-muted-fg)] transition-colors duration-150 hover:bg-[rgba(220,38,38,0.15)] hover:text-[var(--color-destructive-hover)]"
      >
        <IconTrash size={14} />
        Delete
      </button>
      <button
        onClick={() => setMultiSelection([])}
        aria-label="Clear selection"
        className="cursor-pointer rounded p-1 text-[var(--color-muted-fg)] transition-colors duration-150 hover:text-[var(--color-fg)]"
      >
        <IconX size={14} />
      </button>
    </div>
  );
}
