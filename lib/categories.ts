// Functional categories for space-planning bubbles, with keyword-based
// auto-detection (Spanish + English) and a color per category.

export type CategoryId =
  | "core"
  | "public"
  | "services"
  | "infrastructure"
  | "other";

export interface Category {
  id: CategoryId;
  label: string;
  color: string;
  /** Lowercased keywords that map a label to this category. */
  keywords: string[];
}

export const CATEGORIES: Record<CategoryId, Category> = {
  core: {
    id: "core",
    label: "Service Core",
    color: "#8b5cf6", // violet
    keywords: [
      "escalera",
      "ascensor",
      "elevador",
      "nucleo",
      "núcleo",
      "ducto",
      "circulacion",
      "circulación",
      "pasillo",
      "vestibulo",
      "vestíbulo",
      "rampa",
      "core",
      "stair",
      "elevator",
      "lift",
      "corridor",
      "hallway",
      "lobby vertical",
    ],
  },
  public: {
    id: "public",
    label: "Public / Social",
    color: "#0ea5e9", // sky blue
    keywords: [
      "lobby",
      "recepcion",
      "recepción",
      "coworking",
      "lounge",
      "cafe",
      "café",
      "sala",
      "espera",
      "breakout",
      "juntas",
      "multiusos",
      "charlas",
      "terraza",
      "comedor",
      "reception",
      "meeting",
      "social",
      "cafeteria",
      "auditorio",
    ],
  },
  services: {
    id: "services",
    label: "Services",
    color: "#10b981", // emerald
    keywords: [
      "bano",
      "baño",
      "banos",
      "baños",
      "wc",
      "sanitario",
      "aseo",
      "limpieza",
      "mantenimiento",
      "basura",
      "lavanderia",
      "lavandería",
      "almacen",
      "almacén",
      "storage",
      "bodega",
      "cocina",
      "bathroom",
      "toilet",
      "restroom",
      "cleaning",
      "laundry",
      "kitchen",
      "janitor",
    ],
  },
  infrastructure: {
    id: "infrastructure",
    label: "Infrastructure",
    color: "#f59e0b", // amber
    keywords: [
      "parqueo",
      "estacionamiento",
      "parking",
      "cisterna",
      "bomba",
      "bombas",
      "electrica",
      "eléctrica",
      "generador",
      "planta electrica",
      "subestacion",
      "subestación",
      "servidor",
      "servidores",
      "it",
      "mdf",
      "idf",
      "data",
      "tablero",
      "cuarto de maquinas",
      "máquinas",
      "hvac",
      "aire acondicionado",
      "tanque",
      "seguridad",
      "control",
      "pump",
      "server",
      "electrical",
      "mechanical",
    ],
  },
  other: {
    id: "other",
    label: "Other",
    color: "#94a3b8", // slate
    keywords: [],
  },
};

export const CATEGORY_ORDER: CategoryId[] = [
  "core",
  "public",
  "services",
  "infrastructure",
  "other",
];

/**
 * Guess a category from a bubble label by keyword match. Picks the category
 * whose keyword appears earliest/strongest; falls back to "other".
 */
export function detectCategory(label: string): CategoryId {
  const text = label.toLowerCase();
  let best: { id: CategoryId; score: number } | null = null;

  for (const id of CATEGORY_ORDER) {
    if (id === "other") continue;
    for (const kw of CATEGORIES[id].keywords) {
      if (text.includes(kw)) {
        // Longer keyword = more specific = higher score.
        const score = kw.length;
        if (!best || score > best.score) best = { id, score };
      }
    }
  }
  return best?.id ?? "other";
}

export function categoryColor(id: CategoryId): string {
  return CATEGORIES[id].color;
}
