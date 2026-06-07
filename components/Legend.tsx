"use client";

import { useMemo, useState } from "react";
import { useDiagram } from "@/store/useDiagram";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import { REFERENCE_AREA, REFERENCE_RADIUS } from "@/lib/bubbleLayout";
import { IconX } from "@/components/icons";

/**
 * Bottom-left legend: category color key (only categories actually present) and
 * the area-scale reference so the proportional sizing is explicit.
 */
export default function Legend() {
  const layer = useDiagram((s) => s.activeLayer());
  const [collapsed, setCollapsed] = useState(false);

  // Which categories appear on this layer.
  const present = useMemo(() => {
    const set = new Set(layer.bubbles.map((b) => b.category ?? "other"));
    return CATEGORY_ORDER.filter((id) => set.has(id));
  }, [layer.bubbles]);

  const hasLinks = layer.links.length > 0;

  if (layer.bubbles.length === 0) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute bottom-3 left-3 cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 py-1.5 text-xs text-[var(--color-fg)] shadow-lg backdrop-blur transition-colors duration-150 hover:bg-[var(--color-surface)]"
      >
        Show legend
      </button>
    );
  }

  return (
    <div className="absolute bottom-3 left-3 w-52 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/90 p-3 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-fg)]">
          Legend
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="cursor-pointer rounded p-0.5 text-[var(--color-muted-fg)] transition-colors duration-150 hover:text-[var(--color-fg)]"
          aria-label="Collapse legend"
        >
          <IconX size={14} />
        </button>
      </div>

      <ul className="space-y-1.5">
        {present.map((id) => (
          <li key={id} className="flex items-center gap-2 text-xs">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: CATEGORIES[id].color }}
            />
            <span className="text-[var(--color-fg)]">
              {CATEGORIES[id].label}
            </span>
          </li>
        ))}
      </ul>

      {hasLinks && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-fg)]">
            Connections
          </span>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2 text-xs">
              <svg width="26" height="8" className="shrink-0" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="26"
                  y2="4"
                  className="stroke-[var(--color-muted-fg)]"
                  strokeWidth="2.5"
                />
              </svg>
              <span className="text-[var(--color-fg)]">Sure / direct</span>
            </li>
            <li className="flex items-center gap-2 text-xs">
              <svg width="26" height="8" className="shrink-0" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="26"
                  y2="4"
                  className="stroke-[var(--color-muted-fg)]"
                  strokeWidth="2.5"
                  strokeDasharray="5 4"
                />
              </svg>
              <span className="text-[var(--color-fg)]">Intermittent / not sure</span>
            </li>
          </ul>
        </div>
      )}

      <div className="mt-3 border-t border-[var(--color-border)] pt-2">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-fg)]">
          Area scale
        </span>
        <div className="flex items-end gap-3">
          <ScaleDot area={REFERENCE_AREA / 4} />
          <ScaleDot area={REFERENCE_AREA} />
        </div>
        <p className="mt-1.5 text-[10px] leading-tight text-[var(--color-muted-fg)]">
          Circle area is proportional to m². {REFERENCE_AREA} m² ≈{" "}
          {REFERENCE_RADIUS * 2}px wide.
        </p>
      </div>
    </div>
  );
}

function ScaleDot({ area }: { area: number }) {
  // Visual mini-dot scaled like the real bubbles (area ∝ value), capped small.
  const px = Math.max(
    10,
    Math.min(34, 34 * Math.sqrt(area / REFERENCE_AREA))
  );
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="rounded-full bg-[var(--color-muted-fg)]/40 ring-1 ring-[var(--color-border)]"
        style={{ width: px, height: px }}
      />
      <span className="font-mono-accent text-[10px] text-[var(--color-muted-fg)]">
        {Math.round(area)} m²
      </span>
    </div>
  );
}
