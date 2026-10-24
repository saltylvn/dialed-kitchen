# 0023. Food emojis, worked out from the name

**Status:** Accepted · 2026-10-23

## Context

The owner wants an emoji next to every food item and ingredient (🍗 chicken thighs, 🍚 rice), however it got into the app: typed, imported from a website or photo, added from the meal plan, or marked In stock. It makes lists quicker to scan in the store.

## Decision

- **Worked out from the name each time it's shown** (`lib/foodEmoji.ts`), not stored. Every source is covered automatically, including everything already in the app, with no database change, no AI quota and no waiting.
- **How a name is read:**
  - Only the part before a comma or bracket ("flour, sifted" → flour).
  - Words made singular (tomatoes → tomato).
  - Two-word foods first ("peanut butter" 🥜, "bell pepper" 🫑, "olive oil" 🫒).
  - Then the **last** food word wins, because English puts the main thing last: "chicken **broth**" 🍲, "garlic **salt**" 🧂, "**chicken** thighs" 🍗.
- **Never a wrong guess:** unknown foods get no emoji. A name that already contains an emoji ("Tacos 🌮") is left as written.
- **Shown by one component** (`components/ui/FoodEmoji`): on the grocery list, In stock, the price book (list and item title) and each recipe's ingredients. It's `aria-hidden`, so VoiceOver reads only the name.

## Alternatives considered

- **AI picks the emoji when an item is added:** smarter on odd names, but costs quota on every add, needs a stored column and a backfill for existing data, and can't run offline.
- **Storing the emoji per item, editable:** lets people override, at the cost of a column on four tables and an editor. Can be added later with this function as the default.

## Consequences

- Lists are easier to scan; adding more foods means one line in `lib/foodEmoji.ts` (with a test).
- Unusual names show no emoji until a keyword is added.
