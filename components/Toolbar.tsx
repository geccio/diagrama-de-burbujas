"use client";

import type Konva from "konva";
import { useDiagram } from "@/store/useDiagram";
import type { Mode } from "@/lib/types";
import { exportStagePng, exportStagePdf } from "@/lib/exportImage";

interface Props {
  onUploadClick: () => void;
  stageRef: React.RefObject<Konva.Stage | null>;
}

const MODES: { id: Mode; label: string; icon: string; hint: string }[] = [
  { id: "select", label: "Select", icon: "🖱️", hint: "Move & edit bubbles" },
  {
    id: "connect",
    label: "Connect",
    icon: "🔗",
    hint: "Click two bubbles to link; click a link to remove",
  },
  {
    id: "draw",
    label: "Measure",
    icon: "📏",
    hint: "Click points to measure in meters; double-click or Esc to finish",
  },
];

export default function Toolbar({ onUploadClick, stageRef }: Props) {
  const mode = useDiagram((s) => s.mode);
  const setMode = useDiagram((s) => s.setMode);
  const ppm = useDiagram((s) => s.diagram.pixelsPerMeter);
  const setPpm = useDiagram((s) => s.setPixelsPerMeter);
  const resetAll = useDiagram((s) => s.resetAll);
  const saving = useDiagram((s) => s.saving);
  const pendingConnectId = useDiagram((s) => s.pendingConnectId);

  function handleExport(kind: "png" | "pdf") {
    const stage = stageRef.current;
    if (!stage) return;
    if (kind === "png") exportStagePng(stage);
    else exportStagePdf(stage);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-700 bg-slate-900 px-3 py-2">
      <span className="mr-1 text-sm font-semibold text-blue-300">
        🫧 Bubble Diagram
      </span>

      {/* Mode buttons */}
      <div className="flex overflow-hidden rounded-lg ring-1 ring-slate-700">
        {MODES.map((m) => (
          <button
            key={m.id}
            title={m.hint}
            onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 text-sm ${
              mode === m.id
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span className="mr-1">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      <div className="h-6 w-px bg-slate-700" />

      <button
        onClick={onUploadClick}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500"
      >
        ⬆ Upload data
      </button>

      {/* Scale */}
      <label className="flex items-center gap-2 text-sm text-slate-300">
        Scale:
        <input
          type="number"
          min={1}
          value={ppm}
          onChange={(e) => setPpm(Number(e.target.value))}
          className="w-20 rounded bg-slate-800 px-2 py-1 text-sm ring-1 ring-slate-700 focus:ring-blue-400"
        />
        px / meter
      </label>

      <div className="h-6 w-px bg-slate-700" />

      {/* Export */}
      <button
        onClick={() => handleExport("png")}
        className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
      >
        ⬇ PNG
      </button>
      <button
        onClick={() => handleExport("pdf")}
        className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
      >
        ⬇ PDF
      </button>

      <button
        onClick={() => {
          if (confirm("Reset everything? This clears all layers and data.")) {
            resetAll();
          }
        }}
        className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:bg-red-900/40 hover:text-red-300"
      >
        Reset
      </button>

      <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
        {mode === "connect" && (
          <span className="text-yellow-300">
            {pendingConnectId
              ? "Click a second bubble to connect…"
              : "Click a bubble to start a connection"}
          </span>
        )}
        <span>{saving ? "Saving…" : "Saved ✓"}</span>
      </div>
    </div>
  );
}
