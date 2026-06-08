"use client";

import { useEffect, useRef, useState } from "react";
import { useDiagram } from "@/store/useDiagram";
import {
  loadOllamaSettings,
  saveOllamaSettings,
  listModels,
  describeOllamaError,
  type OllamaSettings,
} from "@/lib/ollama";
import {
  aiGenerateProgram,
  aiSuggestAdjacencies,
  aiEditBubbles,
  aiCritique,
  aiReadPlanImage,
  normalizeCategory,
  type AiCritiqueItem,
} from "@/lib/aiTasks";
import { readImageFile } from "@/lib/readImage";
import { IconX, IconWarning } from "@/components/icons";
import OllamaSetupHelp from "@/components/OllamaSetupHelp";

interface Props {
  onClose: () => void;
  canvasSize: { width: number; height: number };
}

type Status =
  | { kind: "idle" }
  | { kind: "busy"; msg: string }
  | { kind: "error"; msg: string }
  | { kind: "ok"; msg: string };

export default function AiPanel({ onClose, canvasSize }: Props) {
  const layer = useDiagram((s) => s.activeLayer());
  const addSpaces = useDiagram((s) => s.addSpaces);
  const addLinksByNames = useDiagram((s) => s.addLinksByNames);
  const applyAiEdits = useDiagram((s) => s.applyAiEdits);

  const [settings, setSettings] = useState<OllamaSettings>(loadOllamaSettings());
  const [models, setModels] = useState<string[]>([]);
  const [brief, setBrief] = useState("");
  const [editInstruction, setEditInstruction] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // critique
  const [findings, setFindings] = useState<AiCritiqueItem[] | null>(null);
  // vision
  const planInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveOllamaSettings(settings);
  }, [settings]);

  async function testConnection() {
    setStatus({ kind: "busy", msg: "Connecting to Ollama…" });
    try {
      const list = await listModels(settings);
      setModels(list);
      setStatus({
        kind: "ok",
        msg: list.length
          ? `Connected. ${list.length} model(s) available.`
          : "Connected, but no models installed (run `ollama pull llama3.1`).",
      });
    } catch (e) {
      setStatus({ kind: "error", msg: describeOllamaError(e) });
    }
  }

  async function handleGenerate() {
    if (!brief.trim()) return;
    setStatus({ kind: "busy", msg: "Generating program…" });
    try {
      const spaces = await aiGenerateProgram(settings, brief.trim());
      if (spaces.length === 0) {
        setStatus({ kind: "error", msg: "The model returned no spaces." });
        return;
      }
      addSpaces(
        spaces.map((s) => ({
          name: s.name,
          area: typeof s.area === "number" ? s.area : undefined,
          category: normalizeCategory(s.category),
          floor: s.floor,
        })),
        "replace",
        canvasSize
      );
      setStatus({ kind: "ok", msg: `Created ${spaces.length} spaces.` });
    } catch (e) {
      setStatus({ kind: "error", msg: describeOllamaError(e) });
    }
  }

  async function handleSuggestAdjacencies() {
    const names = layer.bubbles.map((b) => b.label);
    if (names.length < 2) {
      setStatus({
        kind: "error",
        msg: "Add at least two bubbles first.",
      });
      return;
    }
    setStatus({ kind: "busy", msg: "Suggesting adjacencies…" });
    try {
      const adj = await aiSuggestAdjacencies(settings, names);
      addLinksByNames(adj);
      setStatus({
        kind: "ok",
        msg: `Added ${adj.length} suggested connection(s).`,
      });
    } catch (e) {
      setStatus({ kind: "error", msg: describeOllamaError(e) });
    }
  }

  async function handleEdit() {
    if (!editInstruction.trim()) return;
    if (layer.bubbles.length === 0) {
      setStatus({ kind: "error", msg: "There are no bubbles to edit yet." });
      return;
    }
    setStatus({ kind: "busy", msg: "Applying edits…" });
    try {
      const snapshot = layer.bubbles.map((b) => ({
        id: b.id,
        name: b.label,
        area: b.value,
        category: b.category,
        floor: b.floor,
      }));
      const edits = await aiEditBubbles(
        settings,
        snapshot,
        editInstruction.trim()
      );
      const changed = applyAiEdits(
        edits.map((e) => ({
          id: e.id,
          name: e.name,
          area: e.area,
          category: normalizeCategory(e.category) ?? e.category,
          floor: e.floor,
          remove: e.remove,
        }))
      );
      if (changed === 0) {
        setStatus({
          kind: "error",
          msg: "No matching changes were applied. Try rephrasing.",
        });
        return;
      }
      setStatus({
        kind: "ok",
        msg: `Updated ${changed} bubble(s). Press Ctrl+Z to undo.`,
      });
      setEditInstruction("");
    } catch (e) {
      setStatus({ kind: "error", msg: describeOllamaError(e) });
    }
  }

  function snapshot() {
    return layer.bubbles.map((b) => ({
      id: b.id,
      name: b.label,
      area: b.value,
      category: b.category,
      floor: b.floor,
    }));
  }

  async function handleCritique() {
    if (layer.bubbles.length === 0) {
      setStatus({ kind: "error", msg: "Add some bubbles first." });
      return;
    }
    setStatus({ kind: "busy", msg: "Reviewing the layout…" });
    setFindings(null);
    try {
      const conns = layer.links
        .map((k) => {
          const a = layer.bubbles.find((b) => b.id === k.fromBubbleId);
          const b = layer.bubbles.find((x) => x.id === k.toBubbleId);
          return a && b ? { a: a.label, b: b.label } : null;
        })
        .filter(Boolean) as { a: string; b: string }[];
      const result = await aiCritique(settings, snapshot(), conns);
      setFindings(result);
      setStatus({
        kind: "ok",
        msg: result.length
          ? `${result.length} finding(s).`
          : "No major issues found.",
      });
    } catch (e) {
      setStatus({ kind: "error", msg: describeOllamaError(e) });
    }
  }

  async function handlePlanImage(file: File) {
    setStatus({ kind: "busy", msg: "Reading the plan image (vision)…" });
    try {
      const { src } = await readImageFile(file);
      const b64 = src.split(",")[1] ?? "";
      const { spaces, adjacencies } = await aiReadPlanImage(settings, b64);
      if (spaces.length === 0) {
        setStatus({
          kind: "error",
          msg: "The model didn't detect spaces. Try a clearer plan or a vision model like llava.",
        });
        return;
      }
      addSpaces(
        spaces.map((s) => ({
          name: s.name,
          area: typeof s.area === "number" ? s.area : undefined,
          category: normalizeCategory(s.category),
          floor: s.floor,
        })),
        "replace",
        canvasSize
      );
      if (adjacencies.length) setTimeout(() => addLinksByNames(adjacencies), 0);
      setStatus({
        kind: "ok",
        msg: `Read ${spaces.length} spaces from the plan.`,
      });
    } catch (e) {
      setStatus({ kind: "error", msg: describeOllamaError(e) });
    }
  }

  const busy = status.kind === "busy";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="AI assistant"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">AI assistant (Ollama)</h2>
            <p className="text-xs text-[var(--color-muted-fg)]">
              Runs on your own machine. Nothing leaves your computer.
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

        {/* Connection settings */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--color-muted-fg)]">
              Ollama endpoint
            </span>
            <input
              value={settings.endpoint}
              onChange={(e) =>
                setSettings((s) => ({ ...s, endpoint: e.target.value }))
              }
              placeholder="http://localhost:11434"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-fg)] focus:border-[var(--color-ring)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--color-muted-fg)]">
              Model
            </span>
            {models.length > 0 ? (
              <select
                value={settings.model}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, model: e.target.value }))
                }
                className="w-full cursor-pointer rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-fg)] focus:border-[var(--color-ring)]"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={settings.model}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, model: e.target.value }))
                }
                placeholder="llama3.1"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-fg)] focus:border-[var(--color-ring)]"
              />
            )}
          </label>
        </div>

        <button
          onClick={testConnection}
          disabled={busy}
          className="mb-4 cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)] disabled:opacity-50"
        >
          Test connection
        </button>

        {/* Generate program */}
        <div className="mb-4 rounded-xl border border-[var(--color-border)] p-3">
          <h3 className="mb-1 text-sm font-medium">Generate a program</h3>
          <p className="mb-2 text-xs text-[var(--color-muted-fg)]">
            Describe the building; the AI creates bubbles with area, category &
            floor. Replaces the current layer.
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder="e.g. A 3-floor coworking, ~600 m² total, with lobby, cafe, 4 meeting rooms, phone booths, bathrooms per floor, server room, and parking in the basement."
            className="mb-2 w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-fg)] focus:border-[var(--color-ring)]"
          />
          <button
            onClick={handleGenerate}
            disabled={busy || !brief.trim()}
            className="cursor-pointer rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            Generate
          </button>
        </div>

        {/* Suggest adjacencies */}
        <div className="mb-4 rounded-xl border border-[var(--color-border)] p-3">
          <h3 className="mb-1 text-sm font-medium">Suggest adjacencies</h3>
          <p className="mb-2 text-xs text-[var(--color-muted-fg)]">
            Looks at the {layer.bubbles.length} bubbles on this layer and adds
            suggested connections (solid = strong, dashed = optional).
          </p>
          <button
            onClick={handleSuggestAdjacencies}
            disabled={busy || layer.bubbles.length < 2}
            className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)] disabled:opacity-50"
          >
            Suggest connections
          </button>
        </div>

        {/* Edit existing bubbles via instruction */}
        <div className="mb-4 rounded-xl border border-[var(--color-border)] p-3">
          <h3 className="mb-1 text-sm font-medium">Edit existing bubbles</h3>
          <p className="mb-2 text-xs text-[var(--color-muted-fg)]">
            Tell the AI what to change on the {layer.bubbles.length} current
            bubbles. Changes apply right away — Ctrl+Z to undo.
          </p>
          <textarea
            value={editInstruction}
            onChange={(e) => setEditInstruction(e.target.value)}
            rows={2}
            placeholder="e.g. Set all bathrooms to 6 m². Rename 'Nucleo' to 'Core'. Make meeting rooms 20% bigger. Recategorize parking as infrastructure."
            className="mb-2 w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-fg)] focus:border-[var(--color-ring)]"
          />
          <button
            onClick={handleEdit}
            disabled={busy || !editInstruction.trim() || layer.bubbles.length === 0}
            className="cursor-pointer rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            Apply edits
          </button>
        </div>

        {/* Read a floor-plan image (vision) */}
        <div className="mb-4 rounded-xl border border-[var(--color-border)] p-3">
          <h3 className="mb-1 text-sm font-medium">Read a floor-plan image</h3>
          <p className="mb-2 text-xs text-[var(--color-muted-fg)]">
            Upload a plan image; a vision model (e.g. llava) reads the rooms and
            builds bubbles. Replaces the current layer.
          </p>
          <button
            onClick={() => planInput.current?.click()}
            disabled={busy}
            className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)] disabled:opacity-50"
          >
            Upload plan image
          </button>
          <input
            ref={planInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePlanImage(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Design critique */}
        <div className="mb-4 rounded-xl border border-[var(--color-border)] p-3">
          <h3 className="mb-1 text-sm font-medium">Design review</h3>
          <p className="mb-2 text-xs text-[var(--color-muted-fg)]">
            The AI reviews the layout and flags space-planning issues.
          </p>
          <button
            onClick={handleCritique}
            disabled={busy || layer.bubbles.length === 0}
            className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)] disabled:opacity-50"
          >
            Review layout
          </button>
          {findings && findings.length > 0 && (
            <ul className="mt-3 space-y-2">
              {findings.map((f, i) => (
                <li
                  key={i}
                  className="rounded-lg bg-[var(--color-surface-2)] p-2.5 text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        f.severity === "high"
                          ? "bg-[rgba(220,38,38,0.2)] text-red-300"
                          : f.severity === "medium"
                          ? "bg-[rgba(245,158,11,0.2)] text-amber-300"
                          : "bg-[var(--color-surface)] text-[var(--color-muted-fg)]"
                      }`}
                    >
                      {f.severity}
                    </span>
                    <span className="font-medium text-[var(--color-fg)]">
                      {f.title}
                    </span>
                  </div>
                  <p className="mt-1 text-[var(--color-muted-fg)]">{f.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mb-3 text-xs text-[var(--color-muted-fg)]">
          💬 For free-form chat that creates &amp; edits as you go, use the chat
          bubble in the bottom-left corner of the canvas.
        </p>

        {/* Status */}
        {status.kind !== "idle" && (
          <div
            className={`mb-3 flex items-start gap-2 rounded-lg p-3 text-sm ${
              status.kind === "error"
                ? "bg-[rgba(220,38,38,0.15)] text-red-300"
                : status.kind === "ok"
                ? "bg-[rgba(16,185,129,0.15)] text-emerald-300"
                : "bg-[var(--color-surface-2)] text-[var(--color-muted-fg)]"
            }`}
          >
            {status.kind === "error" && (
              <IconWarning size={16} className="mt-0.5 shrink-0" />
            )}
            <span>{status.msg}</span>
          </div>
        )}

        {/* Setup instructions — opens automatically on a connection error. */}
        <OllamaSetupHelp defaultOpen={status.kind === "error"} key={status.kind} />

        <p className="mt-3 text-[11px] leading-tight text-[var(--color-muted-fg)]">
          Smart import mapping is available in the Upload dialog.
        </p>
      </div>
    </div>
  );
}
