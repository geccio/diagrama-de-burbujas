"use client";

import { useMemo } from "react";
import { useDiagram } from "@/store/useDiagram";
import type { LinkKind } from "@/lib/types";
import { IconX } from "@/components/icons";

interface Props {
  onClose: () => void;
}

/**
 * Adjacency matrix: a bubbles × bubbles grid showing which spaces connect.
 * ● solid = sure/direct, ○ dashed = intermittent. A classic space-planning
 * deliverable, generated live from the current layer's links.
 */
export default function AdjacencyMatrix({ onClose }: Props) {
  const layer = useDiagram((s) => s.activeLayer());

  const { bubbles, kindByPair } = useMemo(() => {
    const bubbles = [...layer.bubbles].sort((a, b) =>
      (a.category ?? "other").localeCompare(b.category ?? "other")
    );
    const map = new Map<string, LinkKind>();
    for (const k of layer.links) {
      const key = [k.fromBubbleId, k.toBubbleId].sort().join("|");
      map.set(key, k.kind ?? "solid");
    }
    return { bubbles, kindByPair: map };
  }, [layer.bubbles, layer.links]);

  function cell(aId: string, bId: string) {
    if (aId === bId) return <span className="text-[var(--color-border)]">—</span>;
    const key = [aId, bId].sort().join("|");
    const kind = kindByPair.get(key);
    if (!kind) return null;
    return (
      <span
        className={
          kind === "dashed"
            ? "text-[var(--color-muted-fg)]"
            : "text-[var(--color-primary-hover)]"
        }
        title={kind === "dashed" ? "Intermittent" : "Direct"}
      >
        {kind === "dashed" ? "○" : "●"}
      </span>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Adjacency matrix"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Adjacency matrix</h2>
            <p className="text-xs text-[var(--color-muted-fg)]">
              <span className="text-[var(--color-primary-hover)]">●</span> direct
              · <span>○</span> intermittent — generated from this layer&apos;s
              connections.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-1.5 text-[var(--color-muted-fg)] transition-colors duration-150 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
          >
            <IconX size={18} />
          </button>
        </div>

        {bubbles.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-muted-fg)]">
            No bubbles on this layer yet.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-10 bg-[var(--color-surface)] p-1" />
                  {bubbles.map((b) => (
                    <th
                      key={b.id}
                      className="h-28 max-w-[28px] p-1 align-bottom"
                    >
                      <div
                        className="mx-auto whitespace-nowrap text-[var(--color-muted-fg)]"
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                        }}
                        title={b.label}
                      >
                        {truncate(b.label, 22)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bubbles.map((rowB) => (
                  <tr key={rowB.id}>
                    <th className="sticky left-0 z-10 max-w-[180px] truncate bg-[var(--color-surface)] py-1 pr-2 text-right font-normal text-[var(--color-fg)]">
                      <span className="flex items-center justify-end gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: rowB.color }}
                        />
                        {truncate(rowB.label, 28)}
                      </span>
                    </th>
                    {bubbles.map((colB) => (
                      <td
                        key={colB.id}
                        className="border border-[var(--color-border)] p-0 text-center"
                        style={{ width: 26, height: 26 }}
                      >
                        {cell(rowB.id, colB.id)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
