import type { Diagram } from "./types";

const STORAGE_KEY = "bubble-diagram-v1";

export function loadDiagram(): Diagram | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Diagram;
    // Minimal shape validation so a corrupt value doesn't crash the app.
    if (!parsed || !Array.isArray(parsed.layers) || parsed.layers.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDiagram(diagram: Diagram): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram));
  } catch {
    // Quota exceeded or storage disabled — fail silently.
  }
}

export function clearDiagram(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
