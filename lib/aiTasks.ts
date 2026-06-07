// AI task prompts + result shapes for the Ollama integration.
import {
  chatJson,
  chatJsonMessages,
  type OllamaSettings,
  type ChatMessage,
} from "./ollama";
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

// --- vision: read a floor-plan image / PDF page ---

/**
 * Send an image (base64, no data: prefix) of a floor plan to a vision model and
 * extract spaces + adjacencies. Requires a vision-capable model (e.g. llava).
 */
export async function aiReadPlanImage(
  settings: OllamaSettings,
  imageBase64: string
): Promise<BuildResult> {
  const system =
    "You are an architect reading a floor-plan image. Identify the rooms/spaces " +
    "you can see, estimate each area in m² if labels or a scale are visible " +
    "(otherwise omit area), assign a category (one of [" +
    CATEGORY_LIST +
    "]) and a floor/level if shown. Also infer obvious adjacencies (rooms that " +
    "share a wall or door). Respond ONLY with JSON: " +
    '{"spaces":[{"name":string,"area":number,"category":string,"floor":string}],' +
    '"adjacencies":[{"a":name,"b":name,"kind":"solid"|"dashed"}]}.';
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    {
      role: "user",
      content:
        "Read this floor plan and return the spaces and adjacencies as JSON.",
      images: [imageBase64],
    },
  ];
  const res = await chatJsonMessages<BuildResult>(settings, messages);
  return {
    spaces: Array.isArray(res.spaces) ? res.spaces : [],
    adjacencies: Array.isArray(res.adjacencies) ? res.adjacencies : [],
  };
}

// --- editing existing bubbles via chat instructions ---

export interface AiBubbleSnapshot {
  id: string;
  name: string;
  area?: number;
  category?: CategoryId;
  floor?: string;
}

export interface AiEdit {
  id: string;
  name?: string;
  area?: number;
  category?: CategoryId;
  floor?: string;
  /** When true, delete this bubble. */
  remove?: boolean;
}

export interface EditResult {
  edits: AiEdit[];
}

/**
 * Apply a natural-language instruction to the existing bubbles. The model gets
 * each bubble's id + current fields and returns only the changes (by id).
 */
export async function aiEditBubbles(
  settings: OllamaSettings,
  bubbles: AiBubbleSnapshot[],
  instruction: string
): Promise<AiEdit[]> {
  const system =
    "You edit an architectural bubble diagram per the user's instruction. You " +
    "receive the current bubbles as a JSON array, each with an id and fields " +
    "(name, area in m², category, floor). Apply the instruction and respond ONLY " +
    'with JSON: {"edits":[{"id":string, ...changedFields}]}. Include an item ' +
    "ONLY for bubbles that change; include ONLY the fields that change, plus the " +
    "id. To delete a bubble, return {\"id\":..., \"remove\":true}. Valid category " +
    "values: " +
    CATEGORY_LIST +
    ". Keep ids exactly as given. Do not invent new bubbles. Numbers for area.";
  const user = `Bubbles: ${JSON.stringify(bubbles)}\nInstruction: ${instruction}`;
  const res = await chatJson<EditResult>(settings, system, user);
  return Array.isArray(res.edits) ? res.edits : [];
}

// --- free-form chat (create + edit across turns) ---

export interface ChatAction {
  op: "create" | "edit" | "delete" | "link";
  // create:
  name?: string;
  area?: number;
  category?: CategoryId;
  floor?: string;
  // edit/delete (by id from the snapshot):
  id?: string;
  // link (by names):
  a?: string;
  b?: string;
  kind?: "solid" | "dashed";
}

export interface ChatTurnResult {
  reply: string;
  actions: ChatAction[];
}

/**
 * Conversational assistant that can create AND edit the diagram across turns.
 * `history` is prior user/assistant turns (text only). `bubbles` is the current
 * snapshot (with ids) so the model can reference/edit existing spaces.
 */
export async function aiChatTurn(
  settings: OllamaSettings,
  history: { role: "user" | "assistant"; content: string }[],
  bubbles: AiBubbleSnapshot[],
  userMessage: string
): Promise<ChatTurnResult> {
  const system =
    "You are a conversational assistant for an architectural bubble diagram. " +
    "You can add spaces, edit/delete existing ones, and connect them, based on " +
    "the conversation. The current bubbles (with ids) are given each turn. " +
    "Respond ONLY with JSON: {\"reply\":string,\"actions\":[...]}. Each action " +
    'is one of: {"op":"create","name":str,"area":num,"category":cat,' +
    '"floor":str}; {"op":"edit","id":str, ...changedFields}; ' +
    '{"op":"delete","id":str}; {"op":"link","a":name,"b":name,' +
    '"kind":"solid"|"dashed"}. Categories: ' +
    CATEGORY_LIST +
    ". Use existing ids for edit/delete; use space NAMES for link. If the user " +
    "is just chatting/asking, return an empty actions array and answer in reply. " +
    "Keep reply short.";
  const snapshot = `Current bubbles: ${JSON.stringify(bubbles)}`;
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: `${snapshot}\n\nUser: ${userMessage}` },
  ];
  const res = await chatJsonMessages<ChatTurnResult>(settings, messages);
  return {
    reply: typeof res.reply === "string" ? res.reply : "",
    actions: Array.isArray(res.actions) ? res.actions : [],
  };
}

// --- design critique ---

export interface AiCritiqueItem {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface CritiqueResult {
  findings: AiCritiqueItem[];
}

/** Ask the model to review the layout and flag space-planning issues. */
export async function aiCritique(
  settings: OllamaSettings,
  bubbles: AiBubbleSnapshot[],
  connections: { a: string; b: string }[]
): Promise<AiCritiqueItem[]> {
  const system =
    "You are a senior architect reviewing a space-planning bubble diagram. You " +
    "get the spaces (name, area m², category, floor) and their connections. " +
    "Identify concrete issues and improvements: missing essential spaces " +
    "(e.g. no core/circulation, no bathrooms), poor adjacencies (e.g. bathroom " +
    "far from circulation, kitchen not near dining), unusual areas (too small/" +
    "large for the use), category imbalance, isolated spaces with no connections, " +
    "or floor-stacking problems. Respond ONLY with JSON: " +
    '{"findings":[{"severity":"high"|"medium"|"low","title":string,' +
    '"detail":string}]}. Be specific and reference space names. Limit to the ' +
    "8 most useful findings. If the layout is solid, return few or none.";
  const user = `Spaces: ${JSON.stringify(bubbles)}\nConnections: ${JSON.stringify(
    connections
  )}`;
  const res = await chatJson<CritiqueResult>(settings, system, user);
  return Array.isArray(res.findings) ? res.findings : [];
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
