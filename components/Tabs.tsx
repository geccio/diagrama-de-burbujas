"use client";

import { useState } from "react";
import { useDiagram } from "@/store/useDiagram";
import { IconPlus, IconX } from "@/components/icons";

export default function Tabs() {
  const diagram = useDiagram((s) => s.diagram);
  const setActiveLayer = useDiagram((s) => s.setActiveLayer);
  const addLayer = useDiagram((s) => s.addLayer);
  const renameLayer = useDiagram((s) => s.renameLayer);
  const deleteLayer = useDiagram((s) => s.deleteLayer);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setDraftName(name);
  }

  function commitEdit() {
    if (editingId && draftName.trim()) {
      renameLayer(editingId, draftName.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1">
      {diagram.layers.map((l) => {
        const active = l.id === diagram.activeLayerId;
        const isEditing = editingId === l.id;
        return (
          <div
            key={l.id}
            className={`group flex shrink-0 items-center gap-1 rounded-t-lg px-3 py-1.5 text-sm transition-colors duration-150 ${
              active
                ? "bg-[var(--color-surface)] text-[var(--color-fg)] shadow-[inset_0_2px_0_var(--color-primary)]"
                : "bg-transparent text-[var(--color-muted-fg)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
            }`}
          >
            {isEditing ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                aria-label="Layer name"
                className="w-28 rounded bg-[var(--color-bg)] px-1 text-sm text-[var(--color-fg)] outline-none ring-1 ring-[var(--color-ring)]"
              />
            ) : (
              <button
                onClick={() => setActiveLayer(l.id)}
                onDoubleClick={() => startEdit(l.id, l.name)}
                className="max-w-[160px] cursor-pointer truncate"
                title="Double-click to rename"
              >
                {l.name}
                <span className="font-mono-accent ml-1.5 text-xs text-[var(--color-muted-fg)]">
                  {l.bubbles.length}
                </span>
              </button>
            )}
            {diagram.layers.length > 1 && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Delete layer "${l.name}"? This removes its bubbles, links and drawings.`
                    )
                  ) {
                    deleteLayer(l.id);
                  }
                }}
                className="ml-1 hidden cursor-pointer rounded p-0.5 text-[var(--color-muted-fg)] transition-colors duration-150 hover:text-[var(--color-destructive-hover)] group-hover:inline-flex"
                aria-label={`Delete layer ${l.name}`}
              >
                <IconX size={14} />
              </button>
            )}
          </div>
        );
      })}
      <button
        onClick={addLayer}
        className="ml-1 flex shrink-0 cursor-pointer items-center justify-center rounded-lg p-1.5 text-[var(--color-muted-fg)] transition-colors duration-150 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
        title="Add layer"
        aria-label="Add layer"
      >
        <IconPlus size={16} />
      </button>
    </div>
  );
}
