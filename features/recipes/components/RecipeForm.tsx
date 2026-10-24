"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { NO_NUTRITION, type Nutrition } from "@/lib/nutrition";
import { saveRecipe, type SaveRecipeResult } from "../actions";
import { estimateRecipeNutrition } from "../importActions";
import { SOURCE_TYPES, type RecipeDraft } from "../schema";

const field = "border-border bg-surface mt-2 min-h-12 w-full rounded-xl border px-3 text-[17px]";
const SERVINGS = Array.from({ length: 20 }, (_, i) => i + 1);

// Add or edit a recipe. Ingredients and steps are typed one per line; ingredient amounts
// are read automatically ("1 1/2 cups flour") and matched to the price book on save.
// recipe: an existing recipe (with id) to edit, or a draft (no id) to start from, such as an
// import from a website.
export function RecipeForm({ recipe }: { recipe?: RecipeDraft }) {
  const [result, formAction, pending] = useActionState<SaveRecipeResult, FormData>(
    saveRecipe,
    null,
  );

  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={formAction} className="space-y-5">
      <input type="hidden" name="recipeId" value={recipe?.id ?? ""} />

      <div>
        <label htmlFor="recipe-title" className="font-medium">
          Name
        </label>
        <input
          id="recipe-title"
          name="title"
          required
          maxLength={120}
          defaultValue={recipe?.title}
          placeholder="Chicken and rice"
          className={field}
        />
      </div>

      <div className="flex gap-3">
        <div className="w-28 shrink-0">
          <label htmlFor="recipe-servings" className="font-medium">
            Serves
          </label>
          {/* A native menu: on iPhone it opens as the swipe wheel. */}
          <select
            id="recipe-servings"
            name="servings"
            defaultValue={recipe?.servings ?? 4}
            className={field}
          >
            {SERVINGS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="recipe-source" className="font-medium">
            From
          </label>
          <select
            id="recipe-source"
            name="sourceType"
            defaultValue={recipe?.source_type ?? "own"}
            className={field}
          >
            {Object.entries(SOURCE_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="recipe-source-name" className="font-medium">
          Book, magazine or site <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          id="recipe-source-name"
          name="sourceName"
          maxLength={120}
          defaultValue={recipe?.source_name ?? ""}
          placeholder="Salt Fat Acid Heat, page 112"
          className={field}
        />
      </div>

      <div>
        <label htmlFor="recipe-url" className="font-medium">
          Web address <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          id="recipe-url"
          name="sourceUrl"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          defaultValue={recipe?.source_url ?? ""}
          placeholder="https://"
          className={field}
        />
      </div>

      <div>
        <label htmlFor="recipe-ingredients" className="font-medium">
          Ingredients
        </label>
        <p className="text-muted text-[15px]">
          One per line, like “2 cups flour” or “salt to taste”.
        </p>
        <textarea
          id="recipe-ingredients"
          name="ingredients"
          rows={8}
          defaultValue={recipe?.ingredientsText}
          placeholder={"1 1/2 lb chicken thighs\n2 cups rice\n1 tbsp olive oil\nsalt to taste"}
          className={`${field} py-3 leading-relaxed`}
        />
      </div>

      <div>
        <label htmlFor="recipe-steps" className="font-medium">
          Steps
        </label>
        <p className="text-muted text-[15px]">One step per line.</p>
        <textarea
          id="recipe-steps"
          name="steps"
          rows={8}
          defaultValue={recipe?.stepsText}
          placeholder={
            "Rinse the rice and start it cooking.\nSeason and sear the chicken, 5 minutes a side."
          }
          className={`${field} py-3 leading-relaxed`}
        />
      </div>

      <NutritionFields initial={recipe?.nutrition ?? NO_NUTRITION} form={form} />

      {result?.ok === false && (
        <p role="alert" className="font-medium">
          ⚠️ {result.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-on-accent min-h-12 w-full rounded-xl font-medium disabled:opacity-60"
      >
        {pending ? "Saving…" : recipe?.id ? "Save changes" : "Save recipe"}
      </button>
    </form>
  );
}

const NUTRIENTS = [
  { key: "calories", name: "calories", label: "Calories", unit: "kcal", max: 5000 },
  { key: "protein", name: "protein", label: "Protein", unit: "g", max: 1000 },
  { key: "carbs", name: "carbs", label: "Carbs", unit: "g", max: 1000 },
  { key: "fat", name: "fat", label: "Fat", unit: "g", max: 1000 },
] as const;

const asText = (n: Nutrition) =>
  Object.fromEntries(
    NUTRIENTS.map(({ key }) => [key, n[key] === null ? "" : String(n[key])]),
  ) as Record<keyof Nutrition, string>;

// Calories and macros per serving, all optional. Filled by an import when the page has
// them, by "Estimate with AI" from the ingredients typed above, or by hand.
function NutritionFields({
  initial,
  form,
}: {
  initial: Nutrition;
  form: React.RefObject<HTMLFormElement | null>;
}) {
  const [values, setValues] = useState(() => asText(initial));
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [estimating, startEstimate] = useTransition();

  function estimate() {
    const data = form.current ? new FormData(form.current) : null;
    if (!data) return;
    setMessage(null);
    startEstimate(async () => {
      const result = await estimateRecipeNutrition({
        title: String(data.get("title") ?? ""),
        servings: Number(data.get("servings")) || 4,
        ingredients: String(data.get("ingredients") ?? ""),
      });
      if (result?.ok) {
        setValues(asText(result.nutrition));
        setMessage({
          error: false,
          text: "✓ Estimated per serving. Check the numbers, then save.",
        });
      } else if (result) {
        setMessage({ error: true, text: result.error });
      }
    });
  }

  return (
    <fieldset>
      <legend className="font-medium">
        Nutrition per serving <span className="text-muted font-normal">(optional)</span>
      </legend>
      <p className="text-muted text-[15px]">Adds up on the Plan tab as calories and macros.</p>
      <div className="mt-1 grid grid-cols-4 gap-2">
        {NUTRIENTS.map(({ key, name, label, unit, max }) => (
          <div key={key} className="min-w-0">
            <label htmlFor={`recipe-${name}`} className="text-muted block text-[14px]">
              {label} <span className="sr-only">in {unit === "g" ? "grams" : "calories"}</span>
            </label>
            <input
              id={`recipe-${name}`}
              name={name}
              inputMode="decimal"
              autoComplete="off"
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              placeholder={unit}
              aria-describedby={`recipe-${name}-max`}
              className="border-border bg-surface mt-1 min-h-12 w-full min-w-0 rounded-xl border px-2 text-center text-[17px]"
            />
            <span id={`recipe-${name}-max`} className="sr-only">
              0 to {max} {unit}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={estimate}
        disabled={estimating}
        className="border-border mt-3 min-h-12 w-full rounded-xl border px-4 font-medium disabled:opacity-60"
      >
        {estimating ? "Estimating…" : "Estimate with AI"}
      </button>
      {message && (
        <p role={message.error ? "alert" : "status"} className="mt-2 font-medium">
          {message.error ? "⚠️ " : ""}
          {message.text}
        </p>
      )}
    </fieldset>
  );
}
