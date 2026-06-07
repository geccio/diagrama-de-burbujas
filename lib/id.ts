// Small unique-id helper. Avoids extra deps; good enough for client-side ids.
let counter = 0;

export function uid(prefix = "id"): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${counter}_${rand}`;
}
