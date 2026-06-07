// Helpers for sizing and laying out newly created bubbles.

const MIN_RADIUS = 28;
const MAX_RADIUS = 95;
const DEFAULT_RADIUS = 45;

const PALETTE = [
  "#60a5fa", // blue
  "#34d399", // green
  "#fbbf24", // amber
  "#f87171", // red
  "#a78bfa", // violet
  "#f472b6", // pink
  "#22d3ee", // cyan
  "#fb923c", // orange
  "#a3e635", // lime
  "#c084fc", // purple
];

export function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}

/**
 * Map an array of optional numeric values to radii where bubble *area* is
 * proportional to the value (so radius ∝ √value), clamped to a sane range.
 * Returns DEFAULT_RADIUS for missing / non-numeric values.
 */
export function radiiFromValues(values: (number | undefined)[]): number[] {
  const valid = values.filter(
    (v): v is number => typeof v === "number" && isFinite(v) && v > 0
  );
  if (valid.length === 0) {
    return values.map(() => DEFAULT_RADIUS);
  }
  const min = Math.min(...valid);
  const max = Math.max(...valid);

  return values.map((v) => {
    if (typeof v !== "number" || !isFinite(v) || v <= 0) return DEFAULT_RADIUS;
    if (max === min) return DEFAULT_RADIUS;
    // Normalize on sqrt so area scales linearly with value.
    const t = (Math.sqrt(v) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min));
    return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
  });
}

/**
 * Lay out N bubbles in a simple grid that fills the visible area, leaving
 * room around each based on the largest radius so they don't overlap on spawn.
 */
export function gridPositions(
  count: number,
  radii: number[],
  areaWidth: number,
  areaHeight: number
): { x: number; y: number }[] {
  const maxR = Math.max(DEFAULT_RADIUS, ...radii);
  const cell = maxR * 2 + 30;
  const cols = Math.max(1, Math.floor((areaWidth - 80) / cell));
  const startX = 80 + maxR;
  const startY = 80 + maxR;

  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      x: startX + col * cell,
      y: startY + row * cell,
    };
  });
}

export { DEFAULT_RADIUS, MIN_RADIUS, MAX_RADIUS };
