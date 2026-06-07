// Helpers for sizing and laying out newly created bubbles.

const MIN_RADIUS = 26;
const MAX_RADIUS = 120;
const DEFAULT_RADIUS = 45;

// Reference: a bubble of REFERENCE_AREA m² is drawn at REFERENCE_RADIUS px.
// Area is strictly proportional to the value (radius ∝ √value), so a 12 m²
// bubble has exactly 12× the on-screen area of a 1 m² bubble.
const REFERENCE_AREA = 20; // m²
const REFERENCE_RADIUS = 55; // px

const PALETTE = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#f472b6",
  "#22d3ee",
  "#fb923c",
  "#a3e635",
  "#c084fc",
];

export function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}

/**
 * Radius for a single area value such that circle AREA is proportional to the
 * value. radius = REFERENCE_RADIUS * sqrt(value / REFERENCE_AREA), clamped.
 */
export function radiusForValue(value: number | undefined): number {
  if (typeof value !== "number" || !isFinite(value) || value <= 0) {
    return DEFAULT_RADIUS;
  }
  const r = REFERENCE_RADIUS * Math.sqrt(value / REFERENCE_AREA);
  return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r));
}

/**
 * Map an array of optional area values to radii with area strictly
 * proportional to the value. Missing/non-numeric → DEFAULT_RADIUS.
 */
export function radiiFromValues(values: (number | undefined)[]): number[] {
  return values.map(radiusForValue);
}

/**
 * Lay out N bubbles in a grid that fills the visible area, spacing cells by the
 * largest radius so bubbles don't overlap on spawn.
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

export {
  DEFAULT_RADIUS,
  MIN_RADIUS,
  MAX_RADIUS,
  REFERENCE_AREA,
  REFERENCE_RADIUS,
};
