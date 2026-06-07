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
 * Given spreadsheet headers + a few sample rows, ask the model which column maps
 * to name / area / category / floor.
 */
export async function aiMapColumns(
  settings: OllamaSettings,
  headers: string[],
  sampleRows: Record<string, string>[]
): Promise<ColumnMapping> {
  const system =
    "You map spreadsheet columns to fields for an architectural bubble diagram. " +
    "Fields: name (the space/room label), area (numeric m²), category (function " +
    "group), floor (level). Respond ONLY with JSON: " +
    '{"mapping":{"name":header|null,"area":header|null,"category":header|null,' +
    '"floor":header|null}}. Use exact header strings from the provided list, or ' +
    "null if no column fits a field.";
  const user = `Headers: ${JSON.stringify(headers)}\nSample rows: ${JSON.stringify(
    sampleRows.slice(0, 5)
  )}`;
  const res = await chatJson<MappingResult>(settings, system, user);
  return res.mapping ?? {};
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
