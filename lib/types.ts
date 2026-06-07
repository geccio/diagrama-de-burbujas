// Core data model for the bubble diagram tool.
import type { CategoryId } from "./categories";

export type Mode = "select" | "connect" | "draw";
export type Theme = "light" | "dark";

export interface Bubble {
  id: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  /** Optional numeric value (e.g. area in m²) that drove the radius. */
  value?: number;
  color: string;
  /** Functional category (drives color when set). */
  category?: CategoryId;
}

/** Relationship strength a connection represents. */
export type LinkKind = "solid" | "dashed";

export interface Link {
  id: string;
  fromBubbleId: string;
  toBubbleId: string;
  /** "solid" = sure/direct, "dashed" = intermittent/uncertain. Default solid. */
  kind?: LinkKind;
}

export interface Drawing {
  id: string;
  /** Flat list of points [x1, y1, x2, y2, ...] in canvas pixels. */
  points: number[];
  /** Total length in meters at creation time (recomputed on render too). */
  lengthMeters: number;
}

/** Optional background floor-plan image for a layer. */
export interface Background {
  /** Data URL (base64) of the image so it persists with the diagram. */
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  /** When locked, the image can't be moved/resized by dragging. */
  locked: boolean;
}

export interface Layer {
  id: string;
  name: string;
  bubbles: Bubble[];
  links: Link[];
  drawings: Drawing[];
  background?: Background;
}

export interface Diagram {
  layers: Layer[];
  activeLayerId: string;
  /** Conversion ratio used by the measure tool. */
  pixelsPerMeter: number;
  /** Canvas theme. */
  theme?: Theme;
}

/** A parsed table from a spreadsheet or PDF: header row + data rows. */
export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
  /** True when produced by best-effort PDF extraction. */
  approximate?: boolean;
}
