// Helpers for sizing and laying out newly created bubbles.
import type { Bubble } from "./types";
import { CATEGORY_ORDER, type CategoryId } from "./categories";

// Larger floor so labels stay readable even for tiny areas.
const MIN_RADIUS = 38;
const MAX_RADIUS = 130;
const DEFAULT_RADIUS = 48;

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

/**
 * Arrange bubbles into clean vertical clusters grouped by category. Each
 * category becomes a column; bubbles flow top-to-bottom within it, packed by
 * their own size. Returns new {id, x, y} positions; does not mutate input.
 */
export function clusterByCategory(
  bubbles: Bubble[]
): { id: string; x: number; y: number }[] {
  // Group bubbles by category, preserving the canonical category order.
  const groups = new Map<CategoryId, Bubble[]>();
  for (const b of bubbles) {
    const cat = (b.category ?? "other") as CategoryId;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(b);
  }
  const orderedCats = CATEGORY_ORDER.filter((c) => groups.has(c));

  const colGap = 90; // space between category columns
  const rowGap = 28; // vertical space between bubbles in a column
  const topPad = 120; // leave room for the column header
  const leftPad = 80;

  const positions: { id: string; x: number; y: number }[] = [];
  let cursorX = leftPad;

  for (const cat of orderedCats) {
    const items = groups.get(cat)!;
    // Largest bubble in this column sets the column width.
    const colMaxR = Math.max(...items.map((b) => b.radius));
    const centerX = cursorX + colMaxR;

    let y = topPad;
    for (const b of items) {
      y += b.radius;
      positions.push({ id: b.id, x: centerX, y });
      y += b.radius + rowGap;
    }

    cursorX = centerX + colMaxR + colGap;
  }

  return positions;
}

/** Category column headers for the cluster layout (x = column center). */
export function clusterHeaders(
  bubbles: Bubble[]
): { category: CategoryId; x: number; y: number }[] {
  const groups = new Map<CategoryId, Bubble[]>();
  for (const b of bubbles) {
    const cat = (b.category ?? "other") as CategoryId;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(b);
  }
  const orderedCats = CATEGORY_ORDER.filter((c) => groups.has(c));

  const colGap = 90;
  const leftPad = 80;
  const headerY = 70;

  const headers: { category: CategoryId; x: number; y: number }[] = [];
  let cursorX = leftPad;
  for (const cat of orderedCats) {
    const items = groups.get(cat)!;
    const colMaxR = Math.max(...items.map((b) => b.radius));
    headers.push({ category: cat, x: cursorX + colMaxR, y: headerY });
    cursorX = cursorX + colMaxR * 2 + colGap;
  }
  return headers;
}

export {
  DEFAULT_RADIUS,
  MIN_RADIUS,
  MAX_RADIUS,
  REFERENCE_AREA,
  REFERENCE_RADIUS,
};
