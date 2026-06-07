// Heuristics to tell real "space" rows (rooms/areas) from note-like rows that
// slipped into the spreadsheet (sentences, totals, legends, counts).

/** A row looks like a note rather than a nameable space. */
export function looksLikeNote(label: string, hasArea: boolean): boolean {
  const t = label.trim();
  if (!t) return true;

  // Long, sentence-like text with no real area is almost always a note.
  const words = t.split(/\s+/);
  if (!hasArea && words.length >= 7) return true;

  // Ends with a sentence punctuation or contains a colon explanation.
  if (!hasArea && /[.:;]$/.test(t)) return true;

  // Common non-space markers (Spanish + English).
  const noteMarkers = [
    "leyenda",
    "nota",
    "notas",
    "total",
    "subtotal",
    "norma",
    "la norma",
    "densidad",
    "puestos",
    "aprox",
    "approx",
    "legend",
    "note",
    "summary",
  ];
  const lower = t.toLowerCase();
  if (!hasArea && noteMarkers.some((m) => lower.includes(m))) return true;

  return false;
}

/** Split parsed rows into spaces vs notes for the import preview. */
export function partitionRows<T extends { label: string; value?: number }>(
  rows: T[]
): { spaces: T[]; notes: T[] } {
  const spaces: T[] = [];
  const notes: T[] = [];
  for (const r of rows) {
    const hasArea = typeof r.value === "number" && isFinite(r.value) && r.value > 0;
    if (looksLikeNote(r.label, hasArea)) notes.push(r);
    else spaces.push(r);
  }
  return { spaces, notes };
}
