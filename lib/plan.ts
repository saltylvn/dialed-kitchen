import { addDays, isIsoDate } from "./dates";

// The weekly meal plan's pure rules (docs/decisions/0017): which meals there are, how weeks
// are laid out, and which recipes count as "regulars".

// Exactly these four, in this order: snacks come after lunch, before dinner.
export const MEALS = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "snacks", label: "Snacks" },
  { id: "dinner", label: "Dinner" },
] as const;

export type MealId = (typeof MEALS)[number]["id"];
export const MEAL_IDS = MEALS.map((m) => m.id) as [MealId, ...MealId[]];

// Weeks run Monday to Sunday. The Monday on or before a date.
export function mondayOf(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(isoDate, -((weekday + 6) % 7));
}

// The seven dates of the week starting on `monday`.
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// A ?week= value from the address bar, as a Monday, or null if it isn't a real date.
// Any date is accepted and moved to its week's Monday, so old links still work.
export function weekFromParam(value: string | string[] | undefined): string | null {
  if (typeof value !== "string" || !isIsoDate(value)) return null;
  const year = Number(value.slice(0, 4));
  if (year < 2020 || year > 2100) return null;
  return mondayOf(value);
}

// "Monday", "Oct 26": a day's name and short date, without time-zone shifts.
export function dayLabels(isoDate: string): { weekday: string; date: string } {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date);
  return { weekday: format({ weekday: "long" }), date: format({ month: "short", day: "numeric" }) };
}

// "Oct 26 – Nov 1"
export function weekRangeLabel(monday: string): string {
  return `${dayLabels(monday).date} – ${dayLabels(addDays(monday, 6)).date}`;
}

// How far back "planned lately" looks, and how often a recipe must be planned in that time
// to count as a regular and sit with the favorites at the top of the recipe box.
export const RECENT_WEEKS = 8;
export const REGULAR_MIN_PLANS = 3;

// Favorites and regulars first, each group most-planned first, then by title.
export function rankRecipes<T extends { title: string; favorite: boolean; timesPlanned: number }>(
  recipes: readonly T[],
): { top: T[]; rest: T[] } {
  const sorted = [...recipes].sort(
    (a, b) => b.timesPlanned - a.timesPlanned || a.title.localeCompare(b.title),
  );
  const isTop = (r: T) => r.favorite || r.timesPlanned >= REGULAR_MIN_PLANS;
  return { top: sorted.filter(isTop), rest: sorted.filter((r) => !isTop(r)) };
}
