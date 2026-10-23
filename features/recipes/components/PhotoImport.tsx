"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { MAX_PHOTOS, scaledSize } from "@/lib/photos";
import { importRecipeFromPhotos, type ImportResult } from "../importActions";
import type { RecipeDraft } from "../schema";

// Read a recipe from photos (a cookbook or magazine page, a recipe card, a screenshot).
// Each photo is shrunk on the phone to a JPEG first: quicker to send, cheaper for the AI,
// and redrawing it drops hidden photo data like GPS location. Photos are never stored.

const TARGET_BYTES = 1_200_000;

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

// Shrinks a photo to fit 1600 px on its longest side, as a JPEG under ~1.2 MB.
async function shrinkPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = await decode(file, url);
    const { width, height } = scaledSize(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    context.drawImage(image, 0, 0, width, height);
    if ("close" in image) image.close();

    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((done) =>
        canvas.toBlob(done, "image/jpeg", quality),
      );
      if (blob && blob.size <= TARGET_BYTES) return blob;
    }
    throw new Error("Photo too large");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// createImageBitmap is fastest; an <img> is the fallback for formats it can't open.
async function decode(file: File, url: string): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  }
}
