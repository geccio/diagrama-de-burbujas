import type { Diagram } from "./types";

// Project file format: a versioned wrapper around the Diagram so we can evolve
// it later. Background images are embedded as data URLs, so files are portable.

const FILE_VERSION = 1;
const FILE_KIND = "bubble-diagram";

interface ProjectFile {
  kind: typeof FILE_KIND;
  version: number;
  exportedAt: string;
  diagram: Diagram;
}

/** Download the diagram as a .json project file. */
export function exportProject(diagram: Diagram, exportedAt: string) {
  const payload: ProjectFile = {
    kind: FILE_KIND,
    version: FILE_VERSION,
    exportedAt,
    diagram,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bubble-diagram.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Parse + validate a project file, returning its Diagram. Throws on bad input. */
export async function importProject(file: File): Promise<Diagram> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const obj = parsed as Partial<ProjectFile>;
  if (!obj || obj.kind !== FILE_KIND || !obj.diagram) {
    throw new Error("This doesn't look like a Bubble Diagram project file.");
  }
  const d = obj.diagram;
  if (!Array.isArray(d.layers) || d.layers.length === 0) {
    throw new Error("The project file has no layers.");
  }
  // Ensure activeLayerId points at an existing layer.
  if (!d.layers.some((l) => l.id === d.activeLayerId)) {
    d.activeLayerId = d.layers[0].id;
  }
  return d;
}
