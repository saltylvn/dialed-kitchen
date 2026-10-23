// Reads a recipe out of a web page's standard recipe data (schema.org "Recipe" as JSON-LD),
// which most recipe sites include for search engines. No AI, no guessing: if a page has no
// recipe data, this says so. (docs/decisions/0004, 0015)

export type ImportedRecipe = {
  title: string;
  servings: number | null;
  ingredients: string[]; // as written: "1 1/2 cups flour"; lib/ingredients reads them
  steps: string[];
  siteName: string | null;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  deg: "°",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  eacute: "é",
  egrave: "è",
  ntilde: "ñ",
  reg: "®",
  trade: "™",
};

// Recipe data often contains HTML entities and tags inside its text: turn them into plain text.
export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n: string) => safeCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => safeCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+\d*);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function safeCodePoint(n: number): string {
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
}

function isRecipe(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const type = (node as Record<string, unknown>)["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}

// Finds the Recipe in JSON-LD, which may be a single object, an array, or nested in @graph.
function findRecipe(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 5 || !node || typeof node !== "object") return null;
  if (isRecipe(node)) return node;
  const children = Array.isArray(node)
    ? node
    : ((node as Record<string, unknown>)["@graph"] ?? null);
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findRecipe(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// "4", 4, "Serves 4-6", ["4", "4 servings"] → 4 (the first number), kept to 1-50.
function servingsFrom(value: unknown): number | null {
  const text = Array.isArray(value) ? value.map(String).join(" ") : String(value ?? "");
  const n = Number(/\d+/.exec(text)?.[0]);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : null;
}

// recipeInstructions can be a string, a list of strings, HowToStep objects, or HowToSection
// objects that hold steps.
function stepsFrom(value: unknown, depth = 0): string[] {
  if (depth > 3 || value == null) return [];
  if (typeof value === "string") {
    return value
      .split(/\r?\n|<br\s*\/?>|<\/p>|<\/li>/i)
      .map(cleanText)
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap((v) => stepsFrom(v, depth + 1));
  if (typeof value === "object") {
    const node = value as Record<string, unknown>;
    if (node.itemListElement) return stepsFrom(node.itemListElement, depth + 1);
    const text = cleanText(node.text ?? node.name);
    return text ? [text] : [];
  }
  return [];
}

const JSON_LD =
  /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;

export function extractRecipe(html: string): ImportedRecipe | null {
  for (const [, json] of html.matchAll(JSON_LD)) {
    let data: unknown;
    try {
      data = JSON.parse(json!.trim());
    } catch {
      continue; // one broken block shouldn't hide another good one
    }
    const recipe = findRecipe(data);
    if (!recipe) continue;

    const title = cleanText(recipe.name).slice(0, 120);
    const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [])
      .map(cleanText)
      .filter(Boolean)
      .slice(0, 200);
    if (!title && ingredients.length === 0) continue;

    const publisher = recipe.publisher as Record<string, unknown> | undefined;
    return {
      title: title || "Imported recipe",
      servings: servingsFrom(recipe.recipeYield),
      ingredients,
      steps: stepsFrom(recipe.recipeInstructions)
        .map((s) => s.slice(0, 2000))
        .slice(0, 100),
      siteName: cleanText(publisher?.name) || siteNameFrom(html),
    };
  }
  return null;
}

// <meta property="og:site_name" content="…">, for when the recipe data names no publisher.
function siteNameFrom(html: string): string | null {
  const match =
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i.exec(html) ??
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i.exec(html);
  return match ? cleanText(match[1]) || null : null;
}

// The page title, for pages without recipe data (so the form can still be pre-filled).
export function pageTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = match ? cleanText(match[1]).slice(0, 120) : "";
  return title || null;
}
