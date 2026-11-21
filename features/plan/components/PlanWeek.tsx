"use client";

import Link from "next/link";
import { useId, useOptimistic, useState, useTransition } from "react";
import { useToday } from "@/components/useToday";
import {
  dayTotals,
  formatCalories,
  formatGrams,
  NO_NUTRITION,
  type Nutrition,
} from "@/lib/nutrition";
import { dayLabels, MEALS, type MealId } from "@/lib/plan";
import { addToPlan, planLeftovers, removeFromPlan } from "../actions";
import type { RecipeChoice } from "../queries";
import type { PlanEntryRow } from "../schema";

// Seven days of meals, today first (docs/decisions/0054). Every day has four spots, always in this order:
// Breakfast, Lunch, Snacks, Dinner. Tapping an empty spot opens a small form with swipe wheels for
// the recipe and servings (the iPhone shows a native <select> as a wheel). Adding and
// removing show at once and roll back on failure.

type Change = { type: "add"; entry: PlanEntryRow } | { type: "remove"; id: string };

export function PlanWeek({
  days,
  entries,
  recipes,
}: {
  days: string[];
  entries: PlanEntryRow[];
  recipes: RecipeChoice[];
}) {
  const today = useToday();
  const [optimistic, apply] = useOptimistic(entries, (state, change: Change) =>
    change.type === "add" ? [...state, change.entry] : state.filter((e) => e.id !== change.id),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const byId = new Map(recipes.map((r) => [r.id, r]));

  function add(entry: Omit<PlanEntryRow, "id">) {
    setError(null);
    startTransition(async () => {
      apply({ type: "add", entry: { ...entry, id: `pending-${crypto.randomUUID()}` } });
      const result = await addToPlan({
        date: entry.plan_date,
        meal: entry.meal,
        recipeId: entry.recipe_id,
        servings: entry.servings,
      });
      if (!result.ok) setError(result.error);
    });
  }

  // Leftovers of a planned meal, later in the week (decision 0053).
  function addLeftovers(source: PlanEntryRow, date: string, meal: MealId, servings: number) {
    setError(null);
    startTransition(async () => {
      apply({
        type: "add",
        entry: {
          id: `pending-${crypto.randomUUID()}`,
          plan_date: date,
          meal,
          recipe_id: source.recipe_id,
          servings,
          leftover_of: source.id,
        },
      });
      const result = await planLeftovers({ source: source.id, date, meal, servings });
      if (!result.ok) setError(result.error);
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      apply({ type: "remove", id });
      const result = await removeFromPlan(id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="font-medium">
          ⚠️ {error}
        </p>
      )}
      <ol className="space-y-3">
        {days.map((day) => (
          <Day
            key={day}
            day={day}
            isToday={day === today}
            isPast={today !== "" && day < today}
            entries={optimistic.filter((e) => e.plan_date === day)}
            laterDays={days.filter((d) => d > day)}
            byId={byId}
            recipes={recipes}
            onAdd={add}
            onLeftovers={addLeftovers}
            onRemove={remove}
          />
        ))}
      </ol>
    </div>
  );
}

function Day({
  day,
  isToday,
  isPast,
  entries,
  laterDays,
  byId,
  recipes,
  onAdd,
  onLeftovers,
  onRemove,
}: {
  day: string;
  isToday: boolean;
  isPast: boolean;
  entries: PlanEntryRow[];
  laterDays: string[];
  byId: Map<string, RecipeChoice>;
  recipes: RecipeChoice[];
  onAdd: (entry: Omit<PlanEntryRow, "id">) => void;
  onLeftovers: (source: PlanEntryRow, date: string, meal: MealId, servings: number) => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState<MealId | null>(null);
  const [leftoversOf, setLeftoversOf] = useState<string | null>(null); // entry id
  const { weekday, date } = dayLabels(day);
  const headingId = `day-${day}`;

  return (
    <li
      aria-labelledby={headingId}
      className={`bg-surface rounded-xl border px-4 pt-3 pb-1 ${isToday ? "border-primary border-2" : "border-border"}`}
    >
      <h2 id={headingId} className="flex items-baseline gap-2 pb-1">
        <span className={`font-medium ${isPast ? "text-muted" : ""}`}>{weekday}</span>
        <span className="text-muted text-[15px]">{date}</span>
        {isToday && (
          <span className="bg-primary text-on-primary rounded-full px-2.5 py-0.5 text-[13px] font-medium">
            Today
          </span>
        )}
      </h2>

      <ul className="divide-border border-border divide-y border-t">
        {MEALS.map((meal) => {
          const planned = entries.filter((e) => e.meal === meal.id);
          const where = `${weekday} ${meal.label.toLowerCase()}`;
          return (
            <li key={meal.id}>
              <div className="flex min-h-12 items-center gap-2">
                <span className="label w-20 shrink-0">{meal.label}</span>
                {planned.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setAdding(meal.id)}
                    aria-label={`Add ${where}`}
                    aria-expanded={adding === meal.id}
                    className="text-muted -mr-2 flex min-h-12 flex-1 items-center justify-end px-2 text-[15px]"
                  >
                    ＋ Add
                  </button>
                ) : (
                  <ul className="min-w-0 flex-1">
                    {planned.map((entry) => {
                      const title = byId.get(entry.recipe_id)?.title ?? "Recipe";
                      const pending = entry.id.startsWith("pending-");
                      return (
                        <li key={entry.id} className="flex items-center">
                          <Link
                            href={`/recipes?open=${entry.recipe_id}`}
                            className="flex min-h-12 min-w-0 flex-1 flex-col justify-center py-1"
                          >
                            <span className="break-words">{title}</span>
                            <span className="text-muted text-[14px]">
                              {entry.leftover_of ? "Leftovers · " : ""}Serves {entry.servings}
                            </span>
                          </Link>
                          {!entry.leftover_of && laterDays.length > 0 && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                setLeftoversOf(leftoversOf === entry.id ? null : entry.id)
                              }
                              aria-expanded={leftoversOf === entry.id}
                              aria-label={`Plan leftovers of ${title}`}
                              className="text-muted flex min-h-12 shrink-0 items-center px-2 text-[14px] disabled:opacity-40"
                            >
                              Leftovers
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={entry.id.startsWith("pending-")}
                            onClick={() => onRemove(entry.id)}
                            aria-label={`Remove ${title} from ${where}`}
                            className="text-muted -mr-2 flex size-12 shrink-0 items-center justify-center text-2xl disabled:opacity-40"
                          >
                            <span aria-hidden>×</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {planned.map(
                (entry) =>
                  leftoversOf === entry.id && (
                    <LeftoversForm
                      key={entry.id}
                      title={byId.get(entry.recipe_id)?.title ?? "this meal"}
                      days={laterDays}
                      onCancel={() => setLeftoversOf(null)}
                      onAdd={(date, mealId, servings) => {
                        onLeftovers(entry, date, mealId, servings);
                        setLeftoversOf(null);
                      }}
                    />
                  ),
              )}
              {adding === meal.id && (
                <AddMeal
                  meal={meal}
                  where={where}
                  recipes={recipes}
                  onCancel={() => setAdding(null)}
                  onAdd={(recipeId, servings) => {
                    onAdd({
                      plan_date: day,
                      meal: meal.id,
                      recipe_id: recipeId,
                      servings,
                      leftover_of: null,
                    });
                    setAdding(null);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>

      {entries.length > 0 && <DayNutrition entries={entries} byId={byId} />}
    </li>
  );
}

// The day's Calories and Macros, per person: one serving of each planned meal. Two native
// dropdowns (<details>): the total shows on the closed row, the meal-by-meal list inside.
function DayNutrition({
  entries,
  byId,
}: {
  entries: PlanEntryRow[];
  byId: Map<string, RecipeChoice>;
}) {
  const meals = MEALS.flatMap((meal) =>
    entries
      .filter((e) => e.meal === meal.id)
      .map((e) => {
        const recipe = byId.get(e.recipe_id);
        return {
          key: e.id,
          meal: meal.label,
          title: recipe?.title ?? "Recipe",
          label: `${meal.label} (${recipe?.title ?? "recipe"})`,
          nutrition: recipe?.nutrition ?? NO_NUTRITION,
        };
      }),
  );
  const { totals, missing } = dayTotals(meals);
  const macros = (n: Nutrition) =>
    `P ${formatGrams(n.protein)} · C ${formatGrams(n.carbs)} · F ${formatGrams(n.fat)}`;

  return (
    <div className="border-border border-t">
      <Dropdown label="Calories" summary={formatCalories(totals.calories)}>
        <ul>
          {meals.map((m) => (
            <MealLine key={m.key} meal={m.meal} title={m.title}>
              {formatCalories(m.nutrition.calories)}
            </MealLine>
          ))}
        </ul>
        <Missing meals={missing.calories} what="calories" />
      </Dropdown>
      <Dropdown label="Macros" summary={macros(totals)}>
        <ul>
          {meals.map((m) => (
            <MealLine key={m.key} meal={m.meal} title={m.title}>
              {macros(m.nutrition)}
            </MealLine>
          ))}
        </ul>
        <p className="text-muted mt-1 text-[14px]">P protein · C carbs · F fat</p>
        <Missing meals={missing.macros} what="macros" />
      </Dropdown>
    </div>
  );
}

function Dropdown({
  label,
  summary,
  children,
}: {
  label: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-border border-b last:border-b-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{label}</span>
        <span className="ml-auto text-[15px] tabular-nums">{summary}</span>
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="pb-3">
        {children}
        <p className="text-muted mt-1 text-[14px]">Per person: one serving of each meal.</p>
      </div>
    </details>
  );
}

function MealLine({
  meal,
  title,
  children,
}: {
  meal: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-baseline gap-2 py-1 text-[15px]">
      <span className="min-w-0 flex-1 break-words">
        <span className="text-muted">{meal}</span> · {title}
      </span>
      <span className="shrink-0 tabular-nums">{children}</span>
    </li>
  );
}

// Totals are honest: meals without numbers are named, so the total reads as "at least".
function Missing({ meals, what }: { meals: string[]; what: string }) {
  if (meals.length === 0) return null;
  return (
    <p className="mt-1 text-[14px]">
      Not counted yet: {meals.join(", ")}. Add {what} on the recipe (Edit → Estimate with AI).
    </p>
  );
}

// "Chili · 4 of 5 in stock": what you can make from what you have (decision 0053).
function optionLabel(r: RecipeChoice): string {
  return r.stock.total > 0 ? `${r.title} · ${r.stock.have} of ${r.stock.total} in stock` : r.title;
}

const SERVING_CHOICES = Array.from({ length: 12 }, (_, i) => i + 1);

function AddMeal({
  meal,
  where,
  recipes: allRecipes,
  onAdd,
  onCancel,
}: {
  meal: { id: MealId; label: string };
  where: string;
  recipes: RecipeChoice[];
  onAdd: (recipeId: string, servings: number) => void;
  onCancel: () => void;
}) {
  // Only this meal's recipes, then any not sorted yet (so nothing is ever unplannable).
  const forMeal = allRecipes.filter((r) => r.meals.includes(meal.id));
  const unsorted = allRecipes.filter((r) => r.meals.length === 0);
  const recipes = [...forMeal, ...unsorted];
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [servings, setServings] = useState(recipes[0]?.servings ?? 4);
  const id = useId();

  if (recipes.length === 0) {
    return (
      <div className="pb-3">
        <p>
          {allRecipes.length === 0
            ? "Add a recipe first, then plan it here."
            : `No ${meal.label.toLowerCase()} recipes yet. Edit a recipe and tap ${meal.label} under Meals, or add a new one.`}
        </p>
        <div className="mt-2 flex gap-2">
          <Link
            href="/recipes/new"
            className="bg-primary text-on-primary flex min-h-12 flex-1 items-center justify-center rounded-lg px-4 font-medium"
          >
            Add recipe
          </Link>
          <button
            type="button"
            onClick={onCancel}
            className="border-border min-h-12 rounded-lg border px-4 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const top = forMeal.filter((r) => r.top);
  const rest = forMeal.filter((r) => !r.top);
  const servingChoices = SERVING_CHOICES.includes(servings)
    ? SERVING_CHOICES
    : [...SERVING_CHOICES, servings].sort((a, b) => a - b);
  const field = "border-border bg-bg mt-1 min-h-12 w-full rounded-lg border px-3 text-[17px]";

  return (
    <form
      className="space-y-3 pb-3"
      aria-label={`Add to ${where}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (recipeId) onAdd(recipeId, servings);
      }}
    >
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-recipe`} className="font-medium">
            Recipe
          </label>
          <select
            id={`${id}-recipe`}
            value={recipeId}
            onChange={(e) => {
              setRecipeId(e.target.value);
              const chosen = recipes.find((r) => r.id === e.target.value);
              if (chosen) setServings(chosen.servings);
            }}
            className={field}
          >
            {top.length > 0 && (
              <optgroup label="★ Favorites & regulars">
                {top.map((r) => (
                  <option key={r.id} value={r.id}>
                    {optionLabel(r)}
                  </option>
                ))}
              </optgroup>
            )}
            {rest.length > 0 && (
              <optgroup label={top.length > 0 ? `More ${meal.label.toLowerCase()}` : meal.label}>
                {rest.map((r) => (
                  <option key={r.id} value={r.id}>
                    {optionLabel(r)}
                  </option>
                ))}
              </optgroup>
            )}
            {unsorted.length > 0 && (
              <optgroup label="Not sorted yet">
                {unsorted.map((r) => (
                  <option key={r.id} value={r.id}>
                    {optionLabel(r)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <div className="w-24 shrink-0">
          <label htmlFor={`${id}-servings`} className="font-medium">
            Serves
          </label>
          <select
            id={`${id}-servings`}
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
            className={field}
          >
            {servingChoices.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-primary text-on-primary min-h-12 flex-1 rounded-lg px-4 font-medium"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border-border min-h-12 rounded-lg border px-4 font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Leftovers of a meal on a later day of the seven shown: the day, the meal and how many servings,
// each a native wheel on the iPhone. The same recipe is planned again, marked as leftovers.
function LeftoversForm({
  title,
  days,
  onAdd,
  onCancel,
}: {
  title: string;
  days: string[];
  onAdd: (date: string, meal: MealId, servings: number) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(days[0] ?? "");
  const [meal, setMeal] = useState<MealId>("lunch");
  const [servings, setServings] = useState(2);
  const id = useId();

  return (
    <form
      className="space-y-3 pb-3"
      aria-label={`Leftovers of ${title}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (date) onAdd(date, meal, servings);
      }}
    >
      <p className="text-[15px]">Leftovers of {title}:</p>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`${id}-day`}>
          Day
        </label>
        <select
          id={`${id}-day`}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="field min-w-0 flex-1"
        >
          {days.map((d) => (
            <option key={d} value={d}>
              {dayLabels(d).weekday}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`${id}-meal`}>
          Meal
        </label>
        <select
          id={`${id}-meal`}
          value={meal}
          onChange={(e) => {
            const chosen = MEALS.find((m) => m.id === e.target.value);
            if (chosen) setMeal(chosen.id);
          }}
          className="field min-w-0 flex-1"
        >
          {MEALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`${id}-servings`}>
          Servings
        </label>
        <select
          id={`${id}-servings`}
          value={servings}
          onChange={(e) => setServings(Number(e.target.value))}
          className="field w-20 shrink-0"
        >
          {SERVING_CHOICES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary flex-1">
          Plan leftovers
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
