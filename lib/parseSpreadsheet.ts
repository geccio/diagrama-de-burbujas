import * as XLSX from "xlsx";
import type { ParsedTable } from "./types";

/**
 * Parse an Excel (.xlsx/.xls) or CSV file into a header + rows table.
 * Uses the first worksheet. Header row is taken from the first row.
 */
export async function parseSpreadsheet(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("The file has no worksheets.");
  }
  const sheet = workbook.Sheets[firstSheetName];

  // Get rows as arrays so we can take the first row as headers ourselves.
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });

  if (matrix.length === 0) {
    throw new Error("The worksheet is empty.");
  }

  const rawHeaders = matrix[0].map((h) => String(h ?? "").trim());
  // Ensure unique, non-empty header names.
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h, i) => {
    let name = h || `Column ${i + 1}`;
    if (seen.has(name)) {
      const n = (seen.get(name) ?? 0) + 1;
      seen.set(name, n);
      name = `${name} (${n})`;
    } else {
      seen.set(name, 0);
    }
    return name;
  });

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const rowArr = matrix[r];
    const obj: Record<string, string> = {};
    headers.forEach((h, c) => {
      obj[h] = String(rowArr[c] ?? "").trim();
    });
    // Skip fully-empty rows.
    if (Object.values(obj).some((v) => v !== "")) {
      rows.push(obj);
    }
  }

  if (rows.length === 0) {
    throw new Error("No data rows found below the header row.");
  }

  return { headers, rows };
}
