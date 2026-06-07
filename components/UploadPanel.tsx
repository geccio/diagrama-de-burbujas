"use client";

import { useRef, useState } from "react";
import type { ParsedTable } from "@/lib/types";
import { parseSpreadsheet } from "@/lib/parseSpreadsheet";
import { parsePdf } from "@/lib/parsePdf";
import { parseNumber, columnLooksNumeric } from "@/lib/parseNumber";
import { useDiagram } from "@/store/useDiagram";

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");

  const addBubblesFromRows = useDiagram((s) => s.addBubblesFromRows);

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

  function handleGenerate(mode: "add" | "replace") {
    if (!table || !labelCol) return;
    const rows = table.rows
      .map((r) => ({
        label: r[labelCol] ?? "",
        value: sizeCol !== NONE ? parseNumber(r[sizeCol]) : undefined,
      }))
      .filter((r) => r.label !== "" || r.value !== undefined);
    addBubblesFromRows(rows, mode, canvasSize);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-slate-800 p-6 shadow-2xl ring-1 ring-slate-700">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upload data</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="Close"
          >
            ✕
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
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-600 p-10 text-center hover:border-blue-400 hover:bg-slate-700/40"
            >
              <span className="text-3xl">📄</span>
              <p className="mt-2 font-medium">
                Drop a file here or click to browse
              </p>
              <p className="mt-1 text-sm text-slate-400">
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
              <p className="mt-4 text-center text-sm text-blue-300">
                Parsing {fileName}…
              </p>
            )}
            {error && (
              <p className="mt-4 rounded bg-red-900/40 p-3 text-sm text-red-200">
                {error}
              </p>
            )}
          </div>
        )}

        {table && (
          <div>
            {table.approximate && (
              <p className="mb-4 rounded bg-amber-900/40 p-3 text-sm text-amber-200">
                ⚠️ PDF extraction is approximate — PDFs don&apos;t store true
                table structure. Review the columns below before generating.
              </p>
            )}
            <p className="mb-4 text-sm text-slate-300">
              Detected <strong>{table.rows.length}</strong> rows and{" "}
              <strong>{table.headers.length}</strong> columns from{" "}
              <span className="text-slate-100">{fileName}</span>.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-300">
                  Label column (bubble text)
                </span>
                <select
                  value={labelCol}
                  onChange={(e) => setLabelCol(e.target.value)}
                  className="w-full rounded bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-600 focus:ring-blue-400"
                >
                  {table.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-300">
                  Size column (area — optional)
                </span>
                <select
                  value={sizeCol}
                  onChange={(e) => setSizeCol(e.target.value)}
                  className="w-full rounded bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-600 focus:ring-blue-400"
                >
                  <option value={NONE}>— None (uniform size) —</option>
                  {table.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Preview table */}
            <div className="mt-4 max-h-48 overflow-auto rounded ring-1 ring-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-900">
                  <tr>
                    {table.headers.map((h) => (
                      <th
                        key={h}
                        className={`px-2 py-1 font-medium ${
                          h === labelCol
                            ? "text-blue-300"
                            : h === sizeCol
                            ? "text-green-300"
                            : "text-slate-400"
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
                    <tr key={i} className="odd:bg-slate-800/40">
                      {table.headers.map((h) => (
                        <td key={h} className="px-2 py-1 text-slate-300">
                          {r[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-sm text-slate-400">
              Will create <strong>{table.rows.length}</strong> bubbles
              {sizeCol !== NONE && " sized by area"}.
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  setTable(null);
                  setError(null);
                }}
                className="rounded px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                ← Choose another file
              </button>
              <button
                onClick={() => handleGenerate("add")}
                className="rounded bg-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-500"
              >
                Add to layer
              </button>
              <button
                onClick={() => handleGenerate("replace")}
                disabled={!labelCol}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
              >
                Replace layer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
