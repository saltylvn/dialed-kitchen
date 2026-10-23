"use client";

import Link from "next/link";
import { useId, useOptimistic, useState, useTransition } from "react";
import { useToday } from "@/components/useToday";
import { dayLabels, MEALS, type MealId } from "@/lib/plan";
import { addToPlan, removeFromPlan } from "../actions";
import type { RecipeChoice } from "../queries";
import type { PlanEntryRow } from "../schema";

// One week of meals, Monday to Sunday. Every day has four spots, always in this order:
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
  const titles = new Map(recipes.map((r) => [r.id, r.title]));

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
            titles={titles}
            recipes={recipes}
            onAdd={add}
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
  titles,
  recipes,
  onAdd,
  onRemove,
}: {
  day: string;
  isToday: boolean;
  isPast: boolean;
  entries: PlanEntryRow[];
  titles: Map<string, string>;
  recipes: RecipeChoice[];
  onAdd: (entry: Omit<PlanEntryRow, "id">) => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState<MealId | null>(null);
  const { weekday, date } = dayLabels(day);
  const headingId = `day-${day}`;

  return (
    <li
      aria-labelledby={headingId}
      className={`bg-surface rounded-2xl border px-4 pt-3 pb-1 ${isToday ? "border-accent border-2" : "border-border"}`}
    >
      <h2 id={headingId} className="flex items-baseline gap-2 pb-1">
        <span className={`font-medium ${isPast ? "text-muted" : ""}`}>{weekday}</span>
        <span className="text-muted text-[15px]">{date}</span>
        {isToday && (
          <span className="bg-accent text-on-accent rounded-full px-2.5 py-0.5 text-[13px] font-medium">
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
                <span className="text-muted w-20 shrink-0 text-[12px] tracking-[0.1em] uppercase">
                  {meal.label}
                </span>
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
                      const title = titles.get(entry.recipe_id) ?? "Recipe";
                      return (
                        <li key={entry.id} className="flex items-center">
                          <Link
                            href={`/recipes?open=${entry.recipe_id}`}
                            className="flex min-h-12 min-w-0 flex-1 flex-col justify-center py-1"
                          >
                            <span className="break-words">{title}</span>
                            <span className="text-muted text-[14px]">Serves {entry.servings}</span>
                          </Link>
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
              {adding === meal.id && (
                <AddMeal
                  where={where}
                  recipes={recipes}
                  onCancel={() => setAdding(null)}
                  onAdd={(recipeId, servings) => {
                    onAdd({ plan_date: day, meal: meal.id, recipe_id: recipeId, servings });
                    setAdding(null);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

const SERVING_CHOICES = Array.from({ length: 12 }, (_, i) => i + 1);

function AddMeal({
  where,
  recipes,
  onAdd,
  onCancel,
}: {
  where: string;
  recipes: RecipeChoice[];
  onAdd: (recipeId: string, servings: number) => void;
  onCancel: () => void;
}) {
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [servings, setServings] = useState(recipes[0]?.servings ?? 4);
  const id = useId();

  if (recipes.length === 0) {
    return (
      <div className="pb-3">
        <p>Add a recipe first, then plan it here.</p>
        <div className="mt-2 flex gap-2">
          <Link
            href="/recipes/new"
            className="bg-accent text-on-accent flex min-h-12 flex-1 items-center justify-center rounded-xl px-4 font-medium"
          >
            Add recipe
          </Link>
          <button
            type="button"
            onClick={onCancel}
            className="border-border min-h-12 rounded-xl border px-4 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const top = recipes.filter((r) => r.top);
  const rest = recipes.filter((r) => !r.top);
  const servingChoices = SERVING_CHOICES.includes(servings)
    ? SERVING_CHOICES
    : [...SERVING_CHOICES, servings].sort((a, b) => a - b);
  const field = "border-border bg-bg mt-1 min-h-12 w-full rounded-xl border px-3 text-[17px]";

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
                    {r.title}
                  </option>
                ))}
              </optgroup>
            )}
            {rest.length > 0 && (
              <optgroup label={top.length > 0 ? "More recipes" : "Recipes"}>
                {rest.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
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
          className="bg-accent text-on-accent min-h-12 flex-1 rounded-xl px-4 font-medium"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border-border min-h-12 rounded-xl border px-4 font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
