"use client";

import { useState } from "react";
import { useDiagram } from "@/store/useDiagram";

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
    <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-700 bg-slate-800 px-2 py-1">
      {diagram.layers.map((l) => {
        const active = l.id === diagram.activeLayerId;
        const isEditing = editingId === l.id;
        return (
          <div
            key={l.id}
            className={`group flex shrink-0 items-center gap-1 rounded-t px-3 py-1.5 text-sm ${
              active
                ? "bg-slate-900 text-white"
                : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
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
                className="w-28 rounded bg-slate-950 px-1 text-sm outline-none ring-1 ring-blue-400"
              />
            ) : (
              <button
                onClick={() => setActiveLayer(l.id)}
                onDoubleClick={() => startEdit(l.id, l.name)}
                className="max-w-[160px] truncate"
                title="Double-click to rename"
              >
                {l.name}
                <span className="ml-1 text-xs text-slate-500">
                  ({l.bubbles.length})
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
                className="ml-1 hidden text-slate-400 hover:text-red-400 group-hover:inline"
                aria-label="Delete layer"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
      <button
        onClick={addLayer}
        className="ml-1 shrink-0 rounded px-2 py-1 text-lg leading-none text-slate-300 hover:bg-slate-700 hover:text-white"
        title="Add layer"
      >
        +
      </button>
    </div>
  );
}
