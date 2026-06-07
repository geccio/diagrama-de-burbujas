/**
 * Extract a numeric value from a cell string. Handles surrounding text/units
 * ("20 m²", "1,250.5 sqft"), and both 1,234.5 and 1.234,5 styles best-effort.
 * Returns undefined when no number is found.
 */
export function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  let s = String(raw).trim();
  if (!s) return undefined;

  // Keep digits, separators and sign only.
  s = s.replace(/[^0-9.,-]/g, "");
  if (!s) return undefined;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Whichever separator appears last is the decimal separator.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // European: 1.234,5 -> 1234.5
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US: 1,234.5 -> 1234.5
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Only comma: treat as decimal if it looks like one (e.g. "20,5").
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = s.replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  }

  const n = parseFloat(s);
  return isFinite(n) ? n : undefined;
}

/** True if at least half of the sampled values parse as numbers. */
export function columnLooksNumeric(values: (string | undefined)[]): boolean {
  const sample = values.slice(0, 50);
  if (sample.length === 0) return false;
  const numeric = sample.filter((v) => parseNumber(v) !== undefined).length;
  return numeric / sample.length >= 0.5;
}
