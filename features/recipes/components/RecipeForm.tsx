"use client";

import { useActionState } from "react";
import { saveRecipe, type SaveRecipeResult } from "../actions";
import type { RecipeForEdit } from "../queries";
import { SOURCE_TYPES } from "../schema";

const field = "border-border bg-surface mt-2 min-h-12 w-full rounded-xl border px-3 text-[17px]";
const SERVINGS = Array.from({ length: 20 }, (_, i) => i + 1);

// Add or edit a recipe. Ingredients and steps are typed one per line; ingredient amounts
// are read automatically ("1 1/2 cups flour") and matched to the price book on save.
export function RecipeForm({ recipe }: { recipe?: RecipeForEdit }) {
  const [result, formAction, pending] = useActionState<SaveRecipeResult, FormData>(
    saveRecipe,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
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
        {pending ? "Saving…" : recipe ? "Save changes" : "Save recipe"}
      </button>
    </form>
  );
}
