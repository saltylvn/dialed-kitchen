import { formatQuantity } from "./list";
import { unitLabel, type Unit } from "./units";

// Reads an ingredient line the way people (and recipe websites) write it:
//   "2 cups flour"          → 2, cup, "flour"
//   "1 1/2 lb chicken thighs" → 1.5, lb, "chicken thighs"
//   "½ tsp salt"            → 0.5, tsp, "salt"
//   "3 eggs"                → 3, no unit, "eggs"
//   "salt to taste"         → no amount, "salt to taste"
// Units it doesn't know ("2 cloves garlic") stay in the name: nothing is guessed.

export type ParsedIngredient = { quantity: number | null; unit: Unit | null; name: string };

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};

// Words people use for each unit, matched without caring about capitals or a final dot.
// ("T" for tablespoon vs "t" for teaspoon is the one place capitals matter; see below.)
const UNIT_WORDS: Record<string, Unit> = {
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tbs: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  c: "cup",
  "fl oz": "fl_oz",
  "fluid ounce": "fl_oz",
  "fluid ounces": "fl_oz",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  qt: "qt",
  quart: "qt",
  quarts: "qt",
  gal: "gal",
  gallon: "gal",
  gallons: "gal",
  dozen: "dozen",
};

// A number at the start: "2", "1.5", "1/2", "1 1/2", "½", "1½", "1-2" (a range: the first).
const AMOUNT =
  /^(\d+(?:\.\d+)?\s+\d+\/\d+|\d+\s*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\d+\/\d+|\d+(?:\.\d+)?|\.\d+|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])(?:\s*(?:-|–|to)\s*[\d½⅓⅔¼¾⅛⅜⅝⅞./ ]+?(?=\s))?/;

function amountValue(text: string): number | null {
  const t = text.replace(/\s+/g, " ").trim();
  const mixed = /^(\d+) (\d+)\/(\d+)$/.exec(t);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const glued = /^(\d+) ?([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/.exec(t);
  if (glued) return Number(glued[1]) + (UNICODE_FRACTIONS[glued[2]!] ?? 0);
  const fraction = /^(\d+)\/(\d+)$/.exec(t);
  if (fraction) return Number(fraction[2]) === 0 ? null : Number(fraction[1]) / Number(fraction[2]);
  if (t in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[t]!;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseIngredient(line: string): ParsedIngredient | null {
  const text = line
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-•*·]\s*/, "");
  if (!text) return null;

  const amount = AMOUNT.exec(text);
  if (!amount) return { quantity: null, unit: null, name: text };
  const quantity = amountValue(amount[1]!);
  if (quantity === null || quantity <= 0) return { quantity: null, unit: null, name: text };

  let rest = text.slice(amount[0].length).trim();
  let unit: Unit | null = null;

  // Two-word units first ("fl oz", "fluid ounces"), then one word, with an optional dot.
  const words = rest.split(" ");
  for (const take of [2, 1]) {
    const raw = words.slice(0, take).join(" ").replace(/\.$/, "");
    // "T"/"Tbsp" means tablespoon and "t" teaspoon in older recipes.
    const candidate = raw === "T" ? "tbsp" : raw === "t" ? "tsp" : UNIT_WORDS[raw.toLowerCase()];
    if (candidate && words.length > take) {
      unit = candidate;
      rest = words.slice(take).join(" ");
      break;
    }
  }

  const name = rest.replace(/^of\s+/i, "").trim();
  // "2 cups" alone (nothing after the unit) isn't an ingredient: keep it as written.
  const nameIsJustAUnit =
    unit === null && UNIT_WORDS[name.toLowerCase().replace(/\.$/, "")] !== undefined;
  if (!name || nameIsJustAUnit) return { quantity: null, unit: null, name: text };
  return { quantity, unit, name };
}

// Splits pasted text into ingredient lines, skipping blanks.
export function parseIngredientLines(text: string): ParsedIngredient[] {
  return text
    .split(/\r?\n/)
    .map(parseIngredient)
    .filter((i): i is ParsedIngredient => i !== null);
}

// Back to one line of text (for editing): "1½ lb chicken thighs", "salt to taste".
// parseIngredient reads it back to the same thing (tested).
export function formatIngredient({ quantity, unit, name }: ParsedIngredient): string {
  if (quantity === null) return name;
  const amount = formatQuantity(quantity);
  return unit ? `${amount} ${unitLabel(quantity, unit)} ${name}` : `${amount} ${name}`;
}

// The part of an ingredient name used to match the price book:
// "Chicken thighs, boneless" → "chicken thighs".
// The same rule exists in SQL (private.ingredient_key) for In stock; a test checks they agree.
export function matchKey(name: string): string {
  const key = name.split(/[,(]/)[0]!.trim().toLowerCase();
  return key || name.trim().toLowerCase(); // "(optional) garnish" has nothing before the "("
}
