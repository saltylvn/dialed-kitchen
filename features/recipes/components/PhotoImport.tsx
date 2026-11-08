"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { shrinkPhoto } from "@/components/shrinkPhoto";
import { MAX_PHOTOS } from "@/lib/photos";
import { importRecipeFromPhotos, type ImportResult } from "../importActions";
import type { RecipeDraft } from "../schema";

// Read a recipe from photos (a cookbook or magazine page, a recipe card, a screenshot).
// Each photo is shrunk on the phone to a JPEG first: quicker to send, cheaper for the AI,
// and redrawing it drops hidden photo data like GPS location. Photos are never stored.

export function PhotoImport({ onDraft }: { onDraft: (draft: RecipeDraft) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [shrinking, setShrinking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [result, formAction, reading] = useActionState<ImportResult, FormData>(
    async (prev, formData) => {
      const next = await importRecipeFromPhotos(prev, formData);
      if (next?.ok) onDraft(next.draft);
      return next;
    },
    null,
  );
  const busy = shrinking || reading;

  async function onChoose(files: FileList | null) {
    if (!files?.length) return;
    setLocalError(null);
    if (files.length > MAX_PHOTOS) {
      setLocalError(`Choose up to ${MAX_PHOTOS} photos of one recipe.`);
      return;
    }
    setShrinking(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("photo", await shrinkPhoto(file), "photo.jpg");
      }
      startTransition(() => formAction(formData));
    } catch {
      setLocalError("Couldn't open that photo. Try another, or take a screenshot of it.");
    } finally {
      setShrinking(false);
      if (input.current) input.current.value = ""; // choosing the same photo again still works
    }
  }

  const error = localError ?? (result?.ok === false ? result.error : null);

  return (
    <div className="border-border bg-surface rounded-2xl border p-4">
      <p className="font-medium">Import from a photo</p>
      <p className="text-muted text-[15px]">
        A cookbook or magazine page, a recipe card, or a screenshot. Up to {MAX_PHOTOS} photos for
        one recipe.
      </p>
      <label
        className={`bg-accent text-on-accent mt-2 flex min-h-12 items-center justify-center rounded-xl px-4 font-medium ${busy ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
      >
        {shrinking
          ? "Preparing photos…"
          : reading
            ? "Reading the recipe…"
            : "Take or choose photos"}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(e) => onChoose(e.currentTarget.files)}
          className="sr-only"
        />
      </label>
      {reading && (
        <p role="status" className="text-muted mt-2 text-[15px]">
          This can take up to half a minute.
        </p>
      )}
      {error && !busy && (
        <p role="alert" className="mt-2 font-medium">
          ⚠️ {error}
        </p>
      )}
      {result?.ok && !busy && (
        <p role="status" className="mt-2 font-medium">
          {result.complete
            ? "✓ Read it. Check it below against the page, then save."
            : "✓ Read part of it. Fill in what's missing below, then save."}
        </p>
      )}
    </div>
  );
}
