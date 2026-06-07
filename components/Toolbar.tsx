"use client";

import type Konva from "konva";
import { useDiagram } from "@/store/useDiagram";
import type { Mode } from "@/lib/types";
import { exportStagePng, exportStagePdf } from "@/lib/exportImage";
import {
  IconBubbles,
  IconCursor,
  IconLink,
  IconRuler,
  IconUpload,
  IconDownload,
  IconReset,
  IconSun,
  IconMoon,
} from "@/components/icons";

interface Props {
  onUploadClick: () => void;
  stageRef: React.RefObject<Konva.Stage | null>;
}

const MODES: {
  id: Mode;
  label: string;
  Icon: typeof IconCursor;
  hint: string;
}[] = [
  { id: "select", label: "Select", Icon: IconCursor, hint: "Move & edit bubbles" },
  {
    id: "connect",
    label: "Connect",
    Icon: IconLink,
    hint: "Click two bubbles to link; click a link to remove",
  },
  {
    id: "draw",
    label: "Measure",
    Icon: IconRuler,
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
  const theme = useDiagram((s) => s.diagram.theme ?? "light");
  const toggleTheme = useDiagram((s) => s.toggleTheme);

  function handleExport(kind: "png" | "pdf") {
    const stage = stageRef.current;
    if (!stage) return;
    if (kind === "png") exportStagePng(stage);
    else exportStagePdf(stage);
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <span className="font-mono-accent mr-1 flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary-hover)]">
        <IconBubbles size={18} />
        Bubble Diagram
      </span>

      {/* Mode segmented control */}
      <div
        role="radiogroup"
        aria-label="Canvas mode"
        className="flex overflow-hidden rounded-lg border border-[var(--color-border)]"
      >
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              role="radio"
              aria-checked={active}
              title={m.hint}
              onClick={() => setMode(m.id)}
              className={`flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-sm transition-colors duration-150 ${
                active
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted-fg)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
              }`}
            >
              <m.Icon size={16} />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="h-6 w-px bg-[var(--color-border)]" />

      <button
        onClick={onUploadClick}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-accent-hover)]"
      >
        <IconUpload size={16} />
        Upload data
      </button>

      {/* Scale */}
      <label className="flex items-center gap-2 text-sm text-[var(--color-muted-fg)]">
        Scale
        <input
          type="number"
          min={1}
          value={ppm}
          onChange={(e) => setPpm(Number(e.target.value))}
          aria-label="Pixels per meter"
          className="font-mono-accent w-20 cursor-text rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm text-[var(--color-fg)] transition-colors duration-150 focus:border-[var(--color-ring)]"
        />
        <span className="font-mono-accent text-xs">px/m</span>
      </label>

      <div className="h-6 w-px bg-[var(--color-border)]" />

      {/* Export */}
      <button
        onClick={() => handleExport("png")}
        title="Export current view as PNG"
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)]"
      >
        <IconDownload size={16} />
        PNG
      </button>
      <button
        onClick={() => handleExport("pdf")}
        title="Export current view as PDF"
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)]"
      >
        <IconDownload size={16} />
        PDF
      </button>

      <button
        onClick={toggleTheme}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        aria-label="Toggle theme"
        className="flex cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)]"
      >
        {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
      </button>

      <button
        onClick={() => {
          if (confirm("Reset everything? This clears all layers and data.")) {
            resetAll();
          }
        }}
        title="Clear all layers and start fresh"
        className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--color-muted-fg)] transition-colors duration-150 hover:bg-[rgba(220,38,38,0.15)] hover:text-[var(--color-destructive-hover)]"
      >
        <IconReset size={16} />
        Reset
      </button>

      <div className="ml-auto flex items-center gap-3 text-xs text-[var(--color-muted-fg)]">
        {mode === "connect" && (
          <span className="text-[var(--color-primary-hover)]">
            {pendingConnectId
              ? "Click a second bubble to connect…"
              : "Click a bubble to start a connection"}
          </span>
        )}
        <span
          className="flex items-center gap-1.5 font-mono-accent"
          aria-live="polite"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              saving ? "bg-amber-400" : "bg-emerald-400"
            }`}
          />
          {saving ? "Saving…" : "Saved"}
        </span>
      </div>
    </div>
  );
}
