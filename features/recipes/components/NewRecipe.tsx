"use client";

import { useActionState, useState } from "react";
import { importRecipe, type ImportResult } from "../importActions";
import type { RecipeDraft } from "../schema";
import { PhotoImport } from "./PhotoImport";
import { RecipeForm } from "./RecipeForm";

// The Add recipe screen: import from a link or from photos (each fills in the form below to
// check and save), or type a recipe in by hand.
export function NewRecipe() {
  // The latest import, from either source. `version` gives each one a fresh form.
  const [imported, setImported] = useState<{ draft: RecipeDraft; version: number }>();
  const showDraft = (draft: RecipeDraft) =>
    setImported((prev) => ({ draft, version: (prev?.version ?? 0) + 1 }));

  const [result, formAction, pending] = useActionState<ImportResult, FormData>(
    async (prev, formData) => {
      const next = await importRecipe(prev, formData);
      if (next?.ok) showDraft(next.draft);
      return next;
    },
    null,
  );

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

      <PhotoImport onDraft={showDraft} />

      {/* key: a new import replaces the form's starting values. */}
      <RecipeForm key={imported?.version ?? 0} recipe={imported?.draft} />
    </div>
  );
}
