"use client";

import { useMemo, useState } from "react";
import { useDiagram } from "@/store/useDiagram";
import { CATEGORIES, CATEGORY_ORDER, type CategoryId } from "@/lib/categories";
import { IconX } from "@/components/icons";

/**
 * Collapsible top-right panel with live area totals: total m² per category,
 * layer total, bubble count, and % distribution.
 */
// Distinct colors for floor rows (floors have no inherent color like categories).
const FLOOR_COLORS = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#22d3ee",
  "#fb923c",
  "#f472b6",
];
const NO_FLOOR_COLOR = "#94a3b8";
const NO_FLOOR_LABEL = "(no floor)";

type Row = { key: string; label: string; color: string; area: number };

export default function SummaryPanel() {
  const layer = useDiagram((s) => s.activeLayer());
  const selectedBubbleId = useDiagram((s) => s.selectedBubbleId);
  const selectedLinkId = useDiagram((s) => s.selectedLinkId);
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<"category" | "floor">("category");

  const stats = useMemo(() => {
    let total = 0;
    let withArea = 0;
    const byCat = new Map<CategoryId, { area: number; count: number }>();
    // Keep floor insertion order so rows are stable; "(no floor)" sinks to last.
    const byFloor = new Map<string, number>();
    for (const b of layer.bubbles) {
      const cat = (b.category ?? "other") as CategoryId;
      if (!byCat.has(cat)) byCat.set(cat, { area: 0, count: 0 });
      const entry = byCat.get(cat)!;
      entry.count += 1;

      const floor = (b.floor ?? "").trim() || NO_FLOOR_LABEL;
      if (!byFloor.has(floor)) byFloor.set(floor, 0);

      if (typeof b.value === "number" && isFinite(b.value) && b.value > 0) {
        entry.area += b.value;
        byFloor.set(floor, byFloor.get(floor)! + b.value);
        total += b.value;
        withArea += 1;
      }
    }

    const cats: Row[] = CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
      key: c,
      label: CATEGORIES[c].label,
      color: CATEGORIES[c].color,
      area: byCat.get(c)!.area,
    }));

    // Floors: real floors first (alpha), then "(no floor)" last.
    const floorKeys = Array.from(byFloor.keys())
      .filter((f) => f !== NO_FLOOR_LABEL)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const floors: Row[] = floorKeys.map((f, i) => ({
      key: f,
      label: f,
      color: FLOOR_COLORS[i % FLOOR_COLORS.length],
      area: byFloor.get(f)!,
    }));
    if (byFloor.has(NO_FLOOR_LABEL)) {
      floors.push({
        key: NO_FLOOR_LABEL,
        label: NO_FLOOR_LABEL,
        color: NO_FLOOR_COLOR,
        area: byFloor.get(NO_FLOOR_LABEL)!,
      });
    }

    return { total, withArea, cats, floors, count: layer.bubbles.length };
  }, [layer.bubbles]);

  const rows = view === "category" ? stats.cats : stats.floors;

  if (layer.bubbles.length === 0) return null;

  // Avoid overlapping the property panel (which sits top-right when selecting).
  const pushedDown = selectedBubbleId || selectedLinkId;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`absolute right-3 ${
          pushedDown ? "top-[19rem]" : "top-3"
        } cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 py-1.5 text-xs text-[var(--color-fg)] shadow-lg backdrop-blur transition-colors duration-150 hover:bg-[var(--color-surface)]`}
      >
        Show totals
      </button>
    );
  }

  return (
    <div
      className={`absolute right-3 ${
        pushedDown ? "top-[19rem]" : "top-3"
      } w-60 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 shadow-xl backdrop-blur`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-fg)]">
          Totals · {layer.name}
        </span>
        <button
          onClick={() => setOpen(false)}
          className="cursor-pointer rounded p-0.5 text-[var(--color-muted-fg)] transition-colors duration-150 hover:text-[var(--color-fg)]"
          aria-label="Collapse totals"
        >
          <IconX size={14} />
        </button>
      </div>

      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="font-mono-accent text-2xl font-bold text-[var(--color-fg)]">
            {formatArea(stats.total)}
            <span className="ml-1 text-sm font-normal text-[var(--color-muted-fg)]">
              m²
            </span>
          </div>
          <div className="text-xs text-[var(--color-muted-fg)]">
            {stats.count} bubbles · {stats.withArea} with area
          </div>
        </div>
      </div>

      {/* Breakdown toggle: by category or by floor. */}
      <div className="mb-2.5 flex overflow-hidden rounded-lg border border-[var(--color-border)] text-xs">
        {(["category", "floor"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 cursor-pointer px-2 py-1 capitalize transition-colors duration-150 ${
              view === v
                ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                : "bg-[var(--color-surface-2)] text-[var(--color-muted-fg)] hover:text-[var(--color-fg)]"
            }`}
          >
            By {v}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-[var(--color-muted-fg)]">
          No floors assigned yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const pct = stats.total > 0 ? (r.area / stats.total) * 100 : 0;
            return (
              <li key={r.key}>
                <div className="mb-0.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: r.color }}
                    />
                    <span className="text-[var(--color-fg)]">{r.label}</span>
                  </span>
                  <span className="font-mono-accent text-[var(--color-muted-fg)]">
                    {formatArea(r.area)} m²
                  </span>
                </div>
                {/* Proportion bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: r.color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatArea(v: number): string {
  if (v === 0) return "0";
  return Number.isInteger(v)
    ? v.toLocaleString()
    : v.toFixed(1).replace(/\.0$/, "");
}
