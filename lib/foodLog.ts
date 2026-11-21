import type { MealId } from "./plan";

// Calorie counting (docs/decisions/0051): a person's day from their food log, against their
// goal. Pure functions, no I/O. Totals never pretend: entries without calories are named,
// so a total is read as "at least".

export type LogEntry = {
  id: string;
  logDate: string; // YYYY-MM-DD
  meal: MealId;
  planEntryId: string | null;
  label: string;
  portion: number;
  calories: number | null;
  protein: number | null;
};

export type Goal = { calories: number; protein: number | null };

export type DayTotals = {
  calories: number;
  protein: number;
  // Logged things with no calories (so the total is at least this much).
  uncounted: string[];
};

export function dayTotals(entries: readonly LogEntry[], date: string): DayTotals {
  let calories = 0;
  let protein = 0;
  const uncounted: string[] = [];
  for (const e of entries) {
    if (e.logDate !== date) continue;
    if (e.calories === null) uncounted.push(e.label);
    else calories += e.calories;
    if (e.protein !== null) protein += e.protein;
  }
  return { calories, protein: Math.round(protein), uncounted };
}

export type Progress = {
  eaten: number;
  goal: number;
  left: number; // never negative
  over: number; // never negative
  percent: number; // 0–100, for the bar
};

export function progress(eaten: number, goal: number): Progress {
  const safeGoal = Math.max(goal, 1);
  return {
    eaten,
    goal,
    left: Math.max(goal - eaten, 0),
    over: Math.max(eaten - goal, 0),
    percent: Math.min(100, Math.max(0, Math.round((eaten / safeGoal) * 100))),
  };
}

// The portions offered on the wheel: ½ to 3 servings.
export const PORTIONS = [0.5, 1, 1.5, 2, 2.5, 3] as const;

const FRACTIONS: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };

// 0.5 → "½", 1 → "1", 1.5 → "1½", 2.25 → "2¼". Anything else → its plain number.
export function formatPortion(portion: number): string {
  const whole = Math.floor(portion);
  const fraction = FRACTIONS[String(Math.round((portion - whole) * 100) / 100)];
  if (portion - whole === 0) return String(whole);
  if (!fraction) return String(portion);
  return whole === 0 ? fraction : `${whole}${fraction}`;
}

// The goal wheels: calories 1,000–5,000 in steps of 50, protein 0–300 g in steps of 5.
export const GOAL_CALORIES = Array.from({ length: 81 }, (_, i) => 1000 + i * 50);
export const GOAL_PROTEIN = Array.from({ length: 61 }, (_, i) => i * 5);
export const DEFAULT_GOAL: Goal = { calories: 2000, protein: 120 };
