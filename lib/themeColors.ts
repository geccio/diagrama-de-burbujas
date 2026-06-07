import type { Theme } from "./types";

export interface CanvasColors {
  bg: string;
  grid: string;
  label: string;
  link: string;
}

// Theme colors for the Konva canvas. Kept in sync with globals.css tokens but
// defined here too so canvas rendering doesn't depend on getComputedStyle
// timing (which can lag a theme switch).
const LIGHT: CanvasColors = {
  bg: "#f8fafc",
  grid: "#e2e8f0",
  label: "#0f172a",
  link: "#94a3b8",
};

const DARK: CanvasColors = {
  bg: "#0f1115",
  grid: "#1e293b",
  label: "#0b1220",
  link: "#64748b",
};

export function canvasColors(theme: Theme | undefined): CanvasColors {
  return theme === "dark" ? DARK : LIGHT;
}
