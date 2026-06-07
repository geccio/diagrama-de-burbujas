"use client";

import { useRef, useState } from "react";
import type { ParsedTable } from "@/lib/types";
import { parseSpreadsheet } from "@/lib/parseSpreadsheet";
import { parsePdf } from "@/lib/parsePdf";
import { parseNumber, columnLooksNumeric } from "@/lib/parseNumber";
import { partitionRows } from "@/lib/rowClassify";
import { useDiagram } from "@/store/useDiagram";
import { loadOllamaSettings, describeOllamaError } from "@/lib/ollama";
import {
  aiMapColumns,
  aiBuildDiagram,
  normalizeCategory,
} from "@/lib/aiTasks";
import {
  IconX,
  IconSpreadsheet,
  IconWarning,
  IconUpload,
  IconSparkles,
} from "@/components/icons";

interface Props {
  onClose: () => void;
  canvasSize: { width: number; height: number };
}

const NONE = "__none__";

export default function UploadPanel({ onClose, canvasSize }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [labelCol, setLabelCol] = useState<string>("");
  const [sizeCol, setSizeCol] = useState<string>(NONE);
  const [categoryCol, setCategoryCol] = useState<string>(NONE);
  const [floorCol, setFloorCol] = useState<string>(NONE);
  const [excludeNotes, setExcludeNotes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiMapping, setAiMapping] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const addSpaces = useDiagram((s) => s.addSpaces);
  const addLinksByNames = useDiagram((s) => s.addLinksByNames);
  const [aiBuilding, setAiBuilding] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    setTable(null);
    setFileName(file.name);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let parsed: ParsedTable;
      if (ext === "pdf") {
        parsed = await parsePdf(file);
      } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        parsed = await parseSpreadsheet(file);
      } else {
        throw new Error(
          "Unsupported file type. Upload .xlsx, .xls, .csv, or .pdf."
        );
      }
      setTable(parsed);
      // Smart defaults: first column as label; first numeric column as size.
      setLabelCol(parsed.headers[0] ?? "");
      const numericCol = parsed.headers.find((h) =>
        columnLooksNumeric(parsed.rows.map((r) => r[h]))
      );
      setSizeCol(numericCol ?? NONE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file.");
    } finally {
      setLoading(false);
    }
  }

  // Map rows to space objects, optionally dropping note-like rows.
  function buildRows() {
    if (!table || !labelCol) return { spaces: [], notes: [] };
    const mapped = table.rows
      .map((r) => {
        const value = sizeCol !== NONE ? parseNumber(r[sizeCol]) : undefined;
        const category =
          categoryCol !== NONE
            ? normalizeCategory(r[categoryCol])
            : undefined;
        const floor =
          floorCol !== NONE ? (r[floorCol] || undefined) : undefined;
        return {
          // partitionRows expects {label, value}
          label: r[labelCol] ?? "",
          value,
          category,
          floor,
        };
      })
      .filter((r) => r.label !== "" || r.value !== undefined);
    return partitionRows(mapped);
  }

  function handleGenerate(mode: "add" | "replace") {
    const { spaces, notes } = buildRows();
    const rows = excludeNotes ? spaces : [...spaces, ...notes];
    if (rows.length === 0) return;
    addSpaces(
      rows.map((r) => ({
        name: r.label,
        area: r.value,
        category: r.category,
        floor: r.floor,
      })),
      mode,
      canvasSize
    );
    onClose();
  }

  // Use Ollama to map columns → fields.
  async function handleAiMap() {
    if (!table) return;
    setAiMapping(true);
    setAiMsg(null);
    try {
      const mapping = await aiMapColumns(
        loadOllamaSettings(),
        table.headers,
        table.rows
      );
      const has = (h?: string | null) =>
        h && table.headers.includes(h) ? h : null;
      if (has(mapping.name)) setLabelCol(mapping.name!);
      setSizeCol(has(mapping.area) ?? NONE);
      setCategoryCol(has(mapping.category) ?? NONE);
      setFloorCol(has(mapping.floor) ?? NONE);
      setAiMsg("Columns mapped by AI — review below.");
    } catch (e) {
      setAiMsg(describeOllamaError(e));
    } finally {
      setAiMapping(false);
    }
  }

  // Let the AI read the whole table and build the diagram (spaces + links).
  async function handleAiBuild() {
    if (!table) return;
    setAiBuilding(true);
    setAiMsg(null);
    try {
      const { spaces, adjacencies } = await aiBuildDiagram(
        loadOllamaSettings(),
        table.headers,
        table.rows
      );
      if (spaces.length === 0) {
        setAiMsg("The AI didn't find any spaces in this file.");
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
      // Links reference space names — apply after bubbles exist.
      if (adjacencies.length > 0) {
        setTimeout(() => addLinksByNames(adjacencies), 0);
      }
      onClose();
    } catch (e) {
      setAiMsg(describeOllamaError(e));
    } finally {
      setAiBuilding(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Upload data"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upload data</h2>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-[var(--color-muted-fg)] transition-colors duration-150 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
            aria-label="Close dialog"
          >
            <IconX size={18} />
          </button>
        </div>

        {!table && (
          <div>
            <div
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] p-10 text-center transition-colors duration-150 hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)]"
            >
              <IconSpreadsheet size={40} className="text-[var(--color-muted-fg)]" />
              <p className="mt-3 font-medium">
                Drop a file here or click to browse
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted-fg)]">
                Excel (.xlsx, .xls), CSV, or PDF
              </p>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {loading && (
              <p className="mt-4 text-center text-sm text-[var(--color-accent-hover)]">
                Parsing {fileName}…
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-lg bg-[rgba(220,38,38,0.18)] p-3 text-sm text-red-200"
              >
                <IconWarning size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>
        )}

        {table && (
          <div>
            {table.approximate && (
              <p className="mb-4 flex items-start gap-2 rounded-lg bg-[rgba(245,158,11,0.16)] p-3 text-sm text-amber-200">
                <IconWarning size={16} className="mt-0.5 shrink-0" />
                <span>
                  PDF extraction is approximate — PDFs don&apos;t store true
                  table structure. Review the columns below before generating.
                </span>
              </p>
            )}
            <p className="mb-4 text-sm text-[var(--color-muted-fg)]">
              Detected{" "}
              <strong className="font-mono-accent text-[var(--color-fg)]">
                {table.rows.length}
              </strong>{" "}
              rows and{" "}
              <strong className="font-mono-accent text-[var(--color-fg)]">
                {table.headers.length}
              </strong>{" "}
              columns from{" "}
              <span className="text-[var(--color-fg)]">{fileName}</span>.
            </p>

            {/* AI actions: build whole diagram, or just map columns */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                onClick={handleAiBuild}
                disabled={aiBuilding || aiMapping}
                title="Let the AI read the whole file and build the diagram (spaces + connections)"
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                <IconSparkles size={16} />
                {aiBuilding ? "Building…" : "AI: build diagram from this file"}
              </button>
              <button
                onClick={handleAiMap}
                disabled={aiMapping || aiBuilding}
                title="Use Ollama to map columns to name / area / category / floor"
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)] disabled:opacity-50"
              >
                <IconSparkles size={16} />
                {aiMapping ? "Mapping…" : "AI map columns"}
              </button>
              {aiMsg && (
                <span className="text-xs text-[var(--color-muted-fg)]">
                  {aiMsg}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    label: "Name column (bubble text)",
                    value: labelCol,
                    set: setLabelCol,
                    none: false,
                  },
                  {
                    label: "Area column (m² — optional)",
                    value: sizeCol,
                    set: setSizeCol,
                    none: true,
                  },
                  {
                    label: "Category column (optional)",
                    value: categoryCol,
                    set: setCategoryCol,
                    none: true,
                  },
                  {
                    label: "Floor column (optional)",
                    value: floorCol,
                    set: setFloorCol,
                    none: true,
                  },
                ] as const
              ).map((field) => (
                <label key={field.label} className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--color-fg)]">
                    {field.label}
                  </span>
                  <select
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    className="w-full cursor-pointer rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-fg)] transition-colors duration-150 focus:border-[var(--color-ring)]"
                  >
                    {field.none && <option value={NONE}>— None —</option>}
                    {table.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            {/* Preview table */}
            <div className="mt-4 max-h-48 overflow-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[var(--color-surface-2)]">
                  <tr>
                    {table.headers.map((h) => (
                      <th
                        key={h}
                        className={`px-2 py-1.5 font-medium ${
                          h === labelCol
                            ? "text-[var(--color-primary-hover)]"
                            : h === sizeCol
                            ? "text-emerald-300"
                            : "text-[var(--color-muted-fg)]"
                        }`}
                      >
                        {h}
                        {h === labelCol && " (label)"}
                        {h === sizeCol && " (size)"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="odd:bg-[var(--color-surface-2)]/40">
                      {table.headers.map((h) => (
                        <td key={h} className="px-2 py-1 text-[var(--color-fg)]">
                          {r[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(() => {
              const { spaces, notes } = buildRows();
              const willCreate = excludeNotes
                ? spaces.length
                : spaces.length + notes.length;
              return (
                <div className="mt-3 space-y-2">
                  {notes.length > 0 && (
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-[var(--color-surface-2)] p-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={excludeNotes}
                        onChange={(e) => setExcludeNotes(e.target.checked)}
                        className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-primary)]"
                      />
                      <span className="text-[var(--color-fg)]">
                        Skip{" "}
                        <strong className="font-mono-accent">
                          {notes.length}
                        </strong>{" "}
                        note-like rows (long sentences, totals, counts — not real
                        spaces).
                        <span className="mt-0.5 block text-xs text-[var(--color-muted-fg)]">
                          Recommended — keeps the diagram focused on actual rooms.
                        </span>
                      </span>
                    </label>
                  )}
                  <p className="text-sm text-[var(--color-muted-fg)]">
                    Will create{" "}
                    <strong className="font-mono-accent text-[var(--color-fg)]">
                      {willCreate}
                    </strong>{" "}
                    bubbles
                    {sizeCol !== NONE && " sized by area"}.
                  </p>
                </div>
              );
            })()}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  setTable(null);
                  setError(null);
                }}
                className="cursor-pointer rounded-lg px-4 py-2 text-sm text-[var(--color-muted-fg)] transition-colors duration-150 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
              >
                ← Choose another file
              </button>
              <button
                onClick={() => handleGenerate("add")}
                className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm font-medium text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)]"
              >
                Add to layer
              </button>
              <button
                onClick={() => handleGenerate("replace")}
                disabled={!labelCol}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconUpload size={16} />
                Replace layer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
