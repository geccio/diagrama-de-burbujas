// Per-floor area totals, shared by the Totals panel ("By Floor" view) and the
// PNG/PDF export so both show identical floors, colors, and ordering.
import type { Bubble } from "./types";

/** Distinct colors for floor rows (floors have no inherent color). */
export const FLOOR_COLORS = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#22d3ee",
  "#fb923c",
  "#f472b6",
];
export const NO_FLOOR_COLOR = "#94a3b8";
export const NO_FLOOR_LABEL = "(no floor)";

export interface FloorTotal {
  name: string;
  color: string;
  area: number;
  count: number;
}

/**
 * Group bubbles by floor: real floors first (natural sort), "(no floor)" last.
 * Area sums only bubbles with a positive numeric value; count is every bubble.
 */
export function floorTotals(bubbles: Bubble[]): FloorTotal[] {
  const map = new Map<string, { area: number; count: number }>();
  for (const b of bubbles) {
    const floor = (b.floor ?? "").trim() || NO_FLOOR_LABEL;
    if (!map.has(floor)) map.set(floor, { area: 0, count: 0 });
    const e = map.get(floor)!;
    e.count += 1;
    if (typeof b.value === "number" && isFinite(b.value) && b.value > 0) {
      e.area += b.value;
    }
  }

  const realFloors = Array.from(map.keys())
    .filter((f) => f !== NO_FLOOR_LABEL)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const rows: FloorTotal[] = realFloors.map((f, i) => ({
    name: f,
    color: FLOOR_COLORS[i % FLOOR_COLORS.length],
    area: map.get(f)!.area,
    count: map.get(f)!.count,
  }));
  if (map.has(NO_FLOOR_LABEL)) {
    rows.push({
      name: NO_FLOOR_LABEL,
      color: NO_FLOOR_COLOR,
      area: map.get(NO_FLOOR_LABEL)!.area,
      count: map.get(NO_FLOOR_LABEL)!.count,
    });
  }
  return rows;
}
