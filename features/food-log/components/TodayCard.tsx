"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useToday } from "@/components/useToday";
import {
  dayTotals,
  formatPortion,
  PORTIONS,
  progress,
  type Goal,
  type LogEntry,
} from "@/lib/foodLog";
import { dayLabels, MEALS, type MealId } from "@/lib/plan";
import { ateIt, ateThePlan, quickAdd, unlog } from "../actions";

// Today, at the top of the Plan tab (docs/decisions/0051): what I've eaten against my goal,
// today's planned meals with a one-tap "Ate it", "Ate the plan" for the whole day, and quick
// add for anything else. Only the signed-in person's own log is shown. Taps update the
// screen at once (optimistic) and save in the background; a failed save puts it back.

export type PlannedMeal = {
  id: string; // meal_plan_entries.id
  date: string;
  meal: MealId;
  title: string;
  calories: number | null; // per serving
  protein: number | null;
};

type Change =
  | { kind: "log"; entry: LogEntry }
  | { kind: "logMany"; entries: LogEntry[] }
  | { kind: "unlog"; id: string };

export function TodayCard({
  days,
  planned,
  logs,
  goal,
}: {
  days: string[];
  planned: PlannedMeal[];
  logs: LogEntry[];
  goal: Goal | null;
}) {
  const today = useToday();
  const [optimistic, change] = useOptimistic(logs, (state: LogEntry[], c: Change) => {
    if (c.kind === "unlog") return state.filter((e) => e.id !== c.id);
    const added = c.kind === "log" ? [c.entry] : c.entries;
    const replaced = new Set(added.map((e) => e.planEntryId).filter(Boolean));
    return [...state.filter((e) => !e.planEntryId || !replaced.has(e.planEntryId)), ...added];
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // The server can't know the phone's date; show nothing until the phone says, and only
  // when today is in the week on screen.
  if (!today || !days.includes(today)) return null;

  const todays = planned.filter((p) => p.date === today);
  const mine = optimistic.filter((e) => e.logDate === today);
  const logFor = (entryId: string) => mine.find((e) => e.planEntryId === entryId);
  const extras = mine.filter((e) => !e.planEntryId);
  const unlogged = todays.filter((p) => !logFor(p.id));
  const totals = dayTotals(optimistic, today);
  const { weekday, date } = dayLabels(today);

  function save(c: Change, run: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      change(c);
      const result = await run();
      if (!result.ok) setError(result.error ?? "Couldn't save that.");
    });
  }

  // A stand-in log entry shown until the server's answer arrives.
  const guess = (p: PlannedMeal, portion: number): LogEntry => ({
    id: `pending-${p.id}`,
    logDate: today,
    meal: p.meal,
    planEntryId: p.id,
    label: p.title,
    portion,
    calories: p.calories === null ? null : Math.round(p.calories * portion),
    protein: p.protein === null ? null : p.protein * portion,
  });

  return (
    <section aria-labelledby="today-heading" className="card mb-6 p-4">
      <div className="flex items-baseline justify-between">
        <h2 id="today-heading" className="label">
          Today
        </h2>
        <p className="text-muted text-[15px]">
          {weekday}, {date}
        </p>
      </div>

      <Summary goal={goal} calories={totals.calories} protein={totals.protein} />
      {totals.uncounted.length > 0 && (
        <p className="text-muted mt-1 text-[15px]">
          Not counted (no calories): {totals.uncounted.join(", ")}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 font-medium">
          ⚠️ {error}
        </p>
      )}

      {todays.length > 0 && (
        <ul className="divide-border mt-4 divide-y border-t border-[var(--border)]">
          {MEALS.flatMap(({ id, label }) =>
            todays
              .filter((p) => p.meal === id)
              .map((p) => {
                const logged = logFor(p.id);
                return (
                  <li key={p.id} className="flex min-h-14 items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="label">{label}</p>
                      <p className={`break-words ${logged ? "text-muted line-through" : ""}`}>
                        {p.title}
                      </p>
                    </div>
                    {logged ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <label className="sr-only" htmlFor={`portion-${p.id}`}>
                          Servings of {p.title} you ate
                        </label>
                        <select
                          id={`portion-${p.id}`}
                          value={String(logged.portion)}
                          disabled={pending}
                          onChange={(e) => {
                            const portion = Number(e.target.value);
                            save({ kind: "log", entry: guess(p, portion) }, () =>
                              ateIt(p.id, portion),
                            );
                          }}
                          className="field min-h-12 px-2"
                        >
                          {[...new Set([...PORTIONS, logged.portion])]
                            .sort((a, b) => a - b)
                            .map((n) => (
                              <option key={n} value={String(n)}>
                                ✓ {formatPortion(n)}×
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          aria-label={`Undo: I didn't eat ${p.title}`}
                          disabled={pending || logged.id.startsWith("pending-")}
                          onClick={() =>
                            save({ kind: "unlog", id: logged.id }, () => unlog(logged.id))
                          }
                          className="text-muted flex size-12 items-center justify-center text-xl"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          save({ kind: "log", entry: guess(p, 1) }, () => ateIt(p.id, null))
                        }
                        className="btn btn-secondary shrink-0 px-3"
                      >
                        ✓ Ate it
                      </button>
                    )}
                  </li>
                );
              }),
          )}
        </ul>
      )}

      {unlogged.length > 1 && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            save({ kind: "logMany", entries: unlogged.map((p) => guess(p, 1)) }, () =>
              ateThePlan(today),
            )
          }
          className="btn btn-primary mt-3 w-full"
        >
          Ate the plan
        </button>
      )}

      {extras.length > 0 && (
        <ul className="mt-3 space-y-1">
          {extras.map((e) => (
            <li key={e.id} className="flex min-h-12 items-center gap-2">
              <span className="min-w-0 flex-1 break-words">
                {e.label}
                <span className="text-muted"> · {e.calories ?? "?"} kcal</span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${e.label}`}
                disabled={pending || e.id.startsWith("pending-")}
                onClick={() => save({ kind: "unlog", id: e.id }, () => unlog(e.id))}
                className="text-muted flex size-12 items-center justify-center text-xl"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <QuickAdd today={today} onError={setError} />
    </section>
  );
}

function Summary({
  goal,
  calories,
  protein,
}: {
  goal: Goal | null;
  calories: number;
  protein: number;
}) {
  const number = (n: number) => n.toLocaleString("en-US");
  if (!goal) {
    return (
      <div className="mt-2">
        <p>
          <span className="text-[34px] font-medium tabular-nums">{number(calories)}</span>{" "}
          <span className="text-muted">kcal today</span>
        </p>
        <Link
          href="/settings?from=plan#goal"
          className="mt-1 inline-flex min-h-12 items-center underline underline-offset-4"
        >
          Set a daily goal
        </Link>
      </div>
    );
  }
  const p = progress(calories, goal.calories);
  return (
    <div className="mt-2">
      <p>
        <span className="text-[34px] font-medium tabular-nums">
          {number(p.over > 0 ? p.over : p.left)}
        </span>{" "}
        <span className="text-muted">{p.over > 0 ? "kcal over" : "kcal left"}</span>
      </p>
      {/* The bar: drawn with SVG attributes, since inline styles are blocked (CSP). */}
      <svg
        role="img"
        aria-label={`${p.percent}% of your calorie goal`}
        viewBox="0 0 100 4"
        preserveAspectRatio="none"
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
      >
        <rect width="100" height="4" className="fill-surface-2" />
        <rect width={p.percent} height="4" className="fill-primary" />
      </svg>
      <p className="text-muted mt-2 text-[15px] tabular-nums">
        {number(calories)} of {number(goal.calories)} kcal
        {goal.protein !== null && ` · ${Math.round(protein)} of ${goal.protein} g protein`}
      </p>
    </div>
  );
}

// The meal a quick add goes under by default, from the phone's clock.
function mealNow(): MealId {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 17) return "snacks";
  return "dinner";
}

function QuickAdd({ today, onError }: { today: string; onError: (e: string | null) => void }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted mt-2 flex min-h-12 items-center font-medium"
      >
        + Quick add
      </button>
    );
  }

  return (
    <form
      className="mt-3 space-y-2"
      action={(form) => {
        onError(null);
        startTransition(async () => {
          const result = await quickAdd({
            date: today,
            meal: String(form.get("meal")),
            label: String(form.get("label") ?? ""),
            calories: String(form.get("calories") ?? ""),
            protein: String(form.get("protein") ?? ""),
          });
          if (result.ok) setOpen(false);
          else onError(result.error);
        });
      }}
    >
      <label className="sr-only" htmlFor="quick-label">
        What you ate
      </label>
      <input
        id="quick-label"
        name="label"
        required
        maxLength={80}
        autoComplete="off"
        placeholder="What you ate (e.g. Protein bar)"
        className="field w-full"
      />
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="quick-calories">
          Calories
        </label>
        <input
          id="quick-calories"
          name="calories"
          required
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="kcal"
          className="field min-w-0 flex-1"
        />
        <label className="sr-only" htmlFor="quick-protein">
          Protein in grams (optional)
        </label>
        <input
          id="quick-protein"
          name="protein"
          inputMode="decimal"
          placeholder="Protein g"
          className="field min-w-0 flex-1"
        />
      </div>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="quick-meal">
          Meal
        </label>
        <select
          id="quick-meal"
          name="meal"
          defaultValue={mealNow()}
          className="field min-w-0 flex-1"
        >
          {MEALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="btn btn-primary shrink-0 px-5">
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}
