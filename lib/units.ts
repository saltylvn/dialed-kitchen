// Units for package sizes, unit prices and recipes. Each unit belongs to one dimension (weight,
// volume or count) and converts to that dimension's base unit: grams, millilitres, or one
// item. Prices are compared in base units, so a 2 lb bag and a 5 lb bag compare fairly.
//
// The same table exists in SQL (private.unit_to_base in the pricing migration); a test in
// supabase/tests checks the two agree. Units of different dimensions never convert
// (no guessing that a "cup" of flour weighs something).

export type Dimension = "weight" | "volume" | "count";

type UnitDef = { label: string; plural: string; dimension: Dimension; toBase: number };

export const UNITS = {
  // weight → grams
  oz: { label: "oz", plural: "oz", dimension: "weight", toBase: 28.349523125 },
  lb: { label: "lb", plural: "lb", dimension: "weight", toBase: 453.59237 },
  g: { label: "g", plural: "g", dimension: "weight", toBase: 1 },
  kg: { label: "kg", plural: "kg", dimension: "weight", toBase: 1000 },
  // volume → millilitres
  fl_oz: { label: "fl oz", plural: "fl oz", dimension: "volume", toBase: 29.5735295625 },
  // US kitchen measures, exact: 1 cup = 8 fl oz, 1 tbsp = ½ fl oz, 1 tsp = ⅓ tbsp.
  tsp: { label: "tsp", plural: "tsp", dimension: "volume", toBase: 4.92892159375 },
  tbsp: { label: "tbsp", plural: "tbsp", dimension: "volume", toBase: 14.78676478125 },
  cup: { label: "cup", plural: "cups", dimension: "volume", toBase: 236.5882365 },
  qt: { label: "qt", plural: "qt", dimension: "volume", toBase: 946.352946 },
  gal: { label: "gal", plural: "gal", dimension: "volume", toBase: 3785.411784 },
  ml: { label: "ml", plural: "ml", dimension: "volume", toBase: 1 },
  l: { label: "L", plural: "L", dimension: "volume", toBase: 1000 },
  // count → one item
  each: { label: "each", plural: "each", dimension: "count", toBase: 1 },
  dozen: { label: "dozen", plural: "dozen", dimension: "count", toBase: 12 },
} as const satisfies Record<string, UnitDef>;

export type Unit = keyof typeof UNITS;

export const DIMENSIONS: Record<Dimension, { label: string; defaultCompareUnit: Unit }> = {
  weight: { label: "By weight", defaultCompareUnit: "lb" },
  volume: { label: "By volume", defaultCompareUnit: "fl_oz" },
  count: { label: "By count", defaultCompareUnit: "each" },
};

export function isUnit(value: unknown): value is Unit {
  return typeof value === "string" && Object.hasOwn(UNITS, value);
}

export function unitsFor(dimension: Dimension): Unit[] {
  return (Object.keys(UNITS) as Unit[]).filter((u) => UNITS[u].dimension === dimension);
}

export function sameDimension(a: Unit, b: Unit): boolean {
  return UNITS[a].dimension === UNITS[b].dimension;
}

// Price per base unit (per gram, per millilitre, or per item). Mirrors the generated
// item_prices.unit_price_base column in the database.
export function pricePerBase(price: number, quantity: number, unit: Unit): number {
  if (!(price > 0) || !(quantity > 0)) throw new RangeError("Price and quantity must be positive");
  return price / (quantity * UNITS[unit].toBase);
}

// A base-unit price shown in the item's chosen unit, e.g. $/g → $/lb.
export function pricePerUnit(pricePerBaseUnit: number, unit: Unit): number {
  return pricePerBaseUnit * UNITS[unit].toBase;
}
