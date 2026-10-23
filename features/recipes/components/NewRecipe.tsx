"use client";

import { useActionState } from "react";
import { importRecipe, type ImportResult } from "../importActions";
import { RecipeForm } from "./RecipeForm";

// The Add recipe screen: import from a link (fills in the form below to check and save), or
// type a recipe in by hand.
export function NewRecipe() {
  const [result, formAction, pending] = useActionState<ImportResult, FormData>(importRecipe, null);
  const draft = result?.ok ? result.draft : undefined;

  return (
    <div className="space-y-6">
      <form action={formAction} className="border-border bg-surface rounded-2xl border p-4">
        <label htmlFor="import-link" className="font-medium">
          Import from a website
        </label>
        <p className="text-muted text-[15px]">Paste a recipe link to fill in the form below.</p>
        <div className="mt-2 flex gap-2">
          <input
            id="import-link"
            name="link"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoComplete="off"
            required
            placeholder="https://"
            className="border-border bg-bg min-h-12 min-w-0 flex-1 rounded-xl border px-3 text-[17px]"
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-accent text-on-accent min-h-12 shrink-0 rounded-xl px-4 font-medium disabled:opacity-60"
          >
            {pending ? "Importing…" : "Import"}
          </button>
        </div>
        {result?.ok === false && (
          <p role="alert" className="mt-2 font-medium">
            ⚠️ {result.error}
          </p>
        )}
        {result?.ok && (
          <p role="status" className="mt-2 font-medium">
            {result.complete
              ? "✓ Imported. Check it below, then save."
              : "That page doesn't share its recipe in a standard way. The title and link are filled in; add the ingredients and steps below."}
          </p>
        )}
      </form>

      {/* key: a new import replaces the form's starting values. */}
      <RecipeForm key={draft ? `${draft.source_url}-${draft.title}` : "blank"} recipe={draft} />
    </div>
  );
}
