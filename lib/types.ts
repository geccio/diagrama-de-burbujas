// Core data model for the bubble diagram tool.

export type Mode = "select" | "connect" | "draw";

export interface Bubble {
  id: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  /** Optional numeric value (e.g. area in m²) that drove the radius. */
  value?: number;
  color: string;
}

export interface Link {
  id: string;
  fromBubbleId: string;
  toBubbleId: string;
}

export interface Drawing {
  id: string;
  /** Flat list of points [x1, y1, x2, y2, ...] in canvas pixels. */
  points: number[];
  /** Total length in meters at creation time (recomputed on render too). */
  lengthMeters: number;
}

export interface Layer {
  id: string;
  name: string;
  bubbles: Bubble[];
  links: Link[];
  drawings: Drawing[];
}

export interface Diagram {
  layers: Layer[];
  activeLayerId: string;
  /** Conversion ratio used by the measure tool. */
  pixelsPerMeter: number;
}

/** A parsed table from a spreadsheet or PDF: header row + data rows. */
export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
  /** True when produced by best-effort PDF extraction. */
  approximate?: boolean;
}
