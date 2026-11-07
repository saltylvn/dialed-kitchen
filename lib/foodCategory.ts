import { foodMatch } from "./foodEmoji";

// A store section for a food's name, so the Prices view groups items the way a store is
// laid out: 🥬 produce, 🥩 meat, 🥛 dairy… Worked out from the name like the food emoji
// (docs/decisions/0027), so nothing is stored and every item is covered. Unknown → Other.

export const CATEGORIES = [
  { id: "produce", label: "Produce" },
  { id: "meat", label: "Meat & seafood" },
  { id: "dairy", label: "Dairy & eggs" },
  { id: "bakery", label: "Bakery" },
  { id: "pantry", label: "Pantry" },
  { id: "snacks", label: "Snacks & drinks" },
  { id: "other", label: "Other" },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];

// Most emojis stand for one section.
const BY_EMOJI: Record<string, Category> = {
  ...section("produce", "🥔🥕🧅🧄🍅🥒🥬🥦🌶️🍄🥑🍋🍎🍐🍊🍌🍇🍓🫐🍒🍑🥭🍍🥥🍉🥝🌿🌽🍠🫑"),
  ...section("meat", "🍗🥩🥓🌭🍖🐟🦐🦀"),
  ...section("dairy", "🥚🥛🧈🧀🍦"),
  ...section("bakery", "🍞🫓🥯🥞🎂"),
  ...section("pantry", "🍝🍚🌾🫘🥜🧂🫒🫗🍯🍬🍲🥫🥣"),
  ...section("snacks", "🍫🍪☕🍵🧃🥤🍿🥨💧🧊"),
};

// Words whose emoji is shared with another section: yogurt shares 🥣 with oats, and
// powders and pickles live on the shelf, not in produce.
const BY_KEY: Record<string, Category> = {
  yogurt: "dairy",
  "sour cream": "dairy",
  "cream cheese": "dairy",
  "chili powder": "pantry",
  "pepper flake": "pantry",
  "black pepper": "pantry",
  sriracha: "pantry",
  chipotle: "pantry",
  cayenne: "pantry",
  cornmeal: "pantry",
  cornstarch: "pantry",
  pickle: "pantry",
  marinara: "pantry",
  raisin: "pantry",
  applesauce: "pantry",
  "peanut butter": "pantry",
  "almond butter": "pantry",
  "protein powder": "pantry",
  candy: "snacks",
  marshmallow: "snacks",
  "orange juice": "snacks",
  "apple juice": "snacks",
};

function section(category: Category, emojis: string): Record<string, Category> {
  // Split into whole emojis (🌶️ is two code points), not single characters.
  const segments = new Intl.Segmenter("en", { granularity: "grapheme" }).segment(emojis);
  return Object.fromEntries([...segments].map(({ segment }) => [segment, category]));
}

export function foodCategory(name: string): Category {
  const match = foodMatch(name);
  if (!match) return "other";
  return BY_KEY[match.key] ?? BY_EMOJI[match.emoji] ?? "other";
}

// Groups things by section, in store order, leaving out empty sections. Order within a
// section is kept as given.
export function groupByCategory<T>(
  things: readonly T[],
  nameOf: (thing: T) => string,
): { id: Category; label: string; things: T[] }[] {
  const groups = new Map<Category, T[]>();
  for (const thing of things) {
    const category = foodCategory(nameOf(thing));
    groups.set(category, [...(groups.get(category) ?? []), thing]);
  }
  return CATEGORIES.flatMap(({ id, label }) => {
    const inSection = groups.get(id);
    return inSection ? [{ id, label, things: inSection }] : [];
  });
}
