// Ollama client. Runs entirely in the browser, calling the user's own Ollama
// server (default http://localhost:11434). The endpoint + model are
// user-configurable and stored in localStorage.
//
// NOTE: Ollama must allow the app's origin via OLLAMA_ORIGINS (the settings
// panel shows instructions). All calls are local/private to the user.

export interface OllamaSettings {
  endpoint: string;
  model: string;
}

const SETTINGS_KEY = "bubble-diagram-ollama";

export const DEFAULT_OLLAMA: OllamaSettings = {
  endpoint: "http://localhost:11434",
  model: "llama3.1",
};

export function loadOllamaSettings(): OllamaSettings {
  if (typeof window === "undefined") return DEFAULT_OLLAMA;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_OLLAMA;
    const parsed = JSON.parse(raw) as Partial<OllamaSettings>;
    return {
      endpoint: parsed.endpoint || DEFAULT_OLLAMA.endpoint,
      model: parsed.model || DEFAULT_OLLAMA.model,
    };
  } catch {
    return DEFAULT_OLLAMA;
  }
}

export function saveOllamaSettings(s: OllamaSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function base(endpoint: string) {
  return endpoint.replace(/\/+$/, "");
}

/** List installed models (also doubles as a connectivity check). */
export async function listModels(
  settings: OllamaSettings
): Promise<string[]> {
  const res = await fetch(`${base(settings.endpoint)}/api/tags`);
  if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
  const data = (await res.json()) as { models?: { name: string }[] };
  return (data.models ?? []).map((m) => m.name);
}

/**
 * Run a JSON-mode chat completion and return the parsed object.
 * Uses Ollama's `format: "json"` so the model returns valid JSON.
 */
export async function chatJson<T>(
  settings: OllamaSettings,
  system: string,
  user: string
): Promise<T> {
  const res = await fetch(`${base(settings.endpoint)}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.model,
      stream: false,
      format: "json",
      options: { temperature: 0.3 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "";
  try {
    return JSON.parse(content) as T;
  } catch {
    // Some models wrap JSON in prose; try to extract the first {...} block.
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("The model did not return valid JSON.");
  }
}

/** Friendly message for the common CORS / connection failure. */
export function describeOllamaError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Failed to fetch|NetworkError|load failed/i.test(msg)) {
    return (
      "Couldn't reach Ollama. Make sure it's running and that it allows this " +
      "site's origin. Start Ollama with the OLLAMA_ORIGINS environment variable " +
      "set to your app URL (or * for any), then try again."
    );
  }
  return msg;
}
