// AI task prompts + result shapes for the Ollama integration.
import { chatJson, type OllamaSettings } from "./ollama";
import type { CategoryId } from "./categories";

const CATEGORY_LIST = "core, public, services, infrastructure, other";

export interface AiSpace {
  name: string;
  area?: number; // m²
  category?: CategoryId;
  floor?: string;
}

export interface GenerateResult {
  spaces: AiSpace[];
}

/** Generate an architectural program (list of spaces) from a plain-language brief. */
export async function aiGenerateProgram(
  settings: OllamaSettings,
  brief: string
): Promise<AiSpace[]> {
  const system =
    "You are an architectural space-planning assistant. Given a brief, produce a " +
    "realistic program of spaces for a bubble diagram. Respond ONLY with JSON of " +
    'the form {"spaces":[{"name":string,"area":number(m2),"category":one of [' +
    CATEGORY_LIST +
    '],"floor":string}]}. Choose sensible areas in square meters. Use category ' +
    "'core' for stairs/elevators/circulation, 'public' for lobbies/social, " +
    "'services' for bathrooms/cleaning/storage, 'infrastructure' for " +
    "parking/electrical/mechanical, else 'other'. Keep names short.";
  const res = await chatJson<GenerateResult>(settings, system, brief);
  return Array.isArray(res.spaces) ? res.spaces : [];
}

export interface AiAdjacency {
  a: string; // bubble name
  b: string; // bubble name
  kind: "solid" | "dashed";
}

export interface AdjacencyResult {
  adjacencies: AiAdjacency[];
}

/** Suggest adjacencies (connections) among existing space names. */
export async function aiSuggestAdjacencies(
  settings: OllamaSettings,
  names: string[]
): Promise<AiAdjacency[]> {
  const system =
    "You are an architectural space-planning assistant. Given a list of space " +
    "names, suggest which spaces should be adjacent/connected in a bubble " +
    'diagram. Respond ONLY with JSON: {"adjacencies":[{"a":name,"b":name,' +
    '"kind":"solid"|"dashed"}]}. Use "solid" for strong/required adjacency and ' +
    '"dashed" for optional/secondary. Only use names from the provided list. ' +
    "Avoid duplicates and self-links.";
  const user = `Spaces: ${JSON.stringify(names)}`;
  const res = await chatJson<AdjacencyResult>(settings, system, user);
  return Array.isArray(res.adjacencies) ? res.adjacencies : [];
}

export interface ColumnMapping {
  name?: string | null;
  area?: string | null;
  category?: string | null;
  floor?: string | null;
}

export interface MappingResult {
  mapping: ColumnMapping;
}

/**
 * Given spreadsheet headers + rows, ask the model which column maps to
 * name / area / category / floor. Sends a generous sample (capped) so mapping
 * is accurate even when the first few rows are headers/blank/notes.
 */
export async function aiMapColumns(
  settings: OllamaSettings,
  headers: string[],
  rows: Record<string, string>[]
): Promise<ColumnMapping> {
  const system =
    "You map spreadsheet columns to fields for an architectural bubble diagram. " +
    "Fields: name (the space/room label), area (numeric m²), category (function " +
    "group), floor (level). Respond ONLY with JSON: " +
    '{"mapping":{"name":header|null,"area":header|null,"category":header|null,' +
    '"floor":header|null}}. Use exact header strings from the provided list, or ' +
    "null if no column fits a field.";
  const user = `Headers: ${JSON.stringify(headers)}\nRows: ${JSON.stringify(
    sampleForPrompt(rows, 40)
  )}`;
  const res = await chatJson<MappingResult>(settings, system, user);
  return res.mapping ?? {};
}

export interface BuildResult {
  spaces: AiSpace[];
  adjacencies: AiAdjacency[];
}

/**
 * Give the model the WHOLE uploaded table and let it produce a clean diagram:
 * extract each space's name/area/category/floor and suggest adjacencies — in one
 * step. Rows are capped to keep the prompt within a reasonable size.
 */
export async function aiBuildDiagram(
  settings: OllamaSettings,
  headers: string[],
  rows: Record<string, string>[]
): Promise<BuildResult> {
  const system =
    "You are an architectural space-planning assistant. You receive a raw table " +
    "(headers + rows) extracted from a spreadsheet or PDF. Build a clean bubble " +
    "diagram from it. For each REAL space/room (ignore notes, totals, legends, " +
    "blank rows): extract name, area in m² (number, omit if unknown), category " +
    "(one of [" +
    CATEGORY_LIST +
    "]), and floor/level (string, if present). Then suggest adjacencies between " +
    "spaces. Respond ONLY with JSON: " +
    '{"spaces":[{"name":string,"area":number,"category":string,"floor":string}],' +
    '"adjacencies":[{"a":name,"b":name,"kind":"solid"|"dashed"}]}. ' +
    "Category guide: 'core'=stairs/elevators/circulation, 'public'=lobbies/" +
    "social/meeting, 'services'=bathrooms/cleaning/storage, " +
    "'infrastructure'=parking/electrical/mechanical, else 'other'. Use only " +
    "space names you output in the adjacencies. Keep names short.";
  const user = `Headers: ${JSON.stringify(headers)}\nRows: ${JSON.stringify(
    sampleForPrompt(rows, 120)
  )}`;
  const res = await chatJson<BuildResult>(settings, system, user);
  return {
    spaces: Array.isArray(res.spaces) ? res.spaces : [],
    adjacencies: Array.isArray(res.adjacencies) ? res.adjacencies : [],
  };
}

/** Cap rows sent to the model and drop fully-empty ones to save tokens. */
function sampleForPrompt(
  rows: Record<string, string>[],
  max: number
): Record<string, string>[] {
  const nonEmpty = rows.filter((r) =>
    Object.values(r).some((v) => String(v ?? "").trim() !== "")
  );
  return nonEmpty.slice(0, max);
}

/** Normalize an LLM category string to a valid CategoryId. */
export function normalizeCategory(c: string | undefined): CategoryId | undefined {
  if (!c) return undefined;
  const v = c.toLowerCase().trim();
  const valid: CategoryId[] = [
    "core",
    "public",
    "services",
    "infrastructure",
    "other",
  ];
  if (valid.includes(v as CategoryId)) return v as CategoryId;
  // Loose matches
  if (/(stair|eleva|circul|core|n[uú]cleo)/.test(v)) return "core";
  if (/(lobby|public|social|lounge|cowork)/.test(v)) return "public";
  if (/(bath|toilet|ba[nñ]o|clean|service|storage)/.test(v)) return "services";
  if (/(park|electr|mechan|infra|cistern|pump)/.test(v)) return "infrastructure";
  return "other";
}
