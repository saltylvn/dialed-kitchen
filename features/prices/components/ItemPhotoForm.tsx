"use client";

import Image from "next/image";
import { startTransition, useActionState, useState } from "react";
import { centerSquare, ITEM_PHOTO_SIDE, MAX_ITEM_PHOTO_BYTES } from "@/lib/photos";
import { removeItemPhoto, setItemPhoto, type ItemPhotoResult } from "../actions";

const button = "border-border min-h-12 rounded-xl border px-4 font-medium disabled:opacity-60";

// A photo for an item, shown in place of its emoji. On iPhone the button offers Take Photo,
// Photo Library or Choose File. The phone crops the middle square and shrinks it to a small
// JPEG before sending, so it uploads fast on cellular; the server checks it again.
export function ItemPhotoForm({ itemId, photo }: { itemId: string; photo: string | null }) {
  const [saved, saveAction, saving] = useActionState<ItemPhotoResult, FormData>(setItemPhoto, null);
  const [removed, removeAction, removing] = useActionState<ItemPhotoResult, FormData>(
    removeItemPhoto,
    null,
  );
  const [problem, setProblem] = useState<string | null>(null);
  const pending = saving || removing;
  const error =
    problem ??
    (saved?.ok === false ? saved.error : null) ??
    (removed?.ok === false ? removed.error : null);

  async function onChoose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    try {
      const form = new FormData();
      form.set("itemId", itemId);
      form.set("photo", await squarePhoto(file), "photo.jpg");
      startTransition(() => saveAction(form));
    } catch {
      setProblem("That photo couldn't be read. Try another.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {photo && (
          <Image
            src={photo}
            alt="This item's photo"
            width={64}
            height={64}
            unoptimized
            className="border-border size-16 shrink-0 rounded-xl border object-cover"
          />
        )}
        <label
          className={`${button} bg-accent text-on-accent flex flex-1 cursor-pointer items-center justify-center border-transparent has-[:disabled]:opacity-60`}
        >
          {saving ? "Saving…" : photo ? "Change photo" : "Take or choose a photo"}
          <input
            type="file"
            accept="image/*"
            disabled={pending}
            className="sr-only"
            onChange={(e) => {
              void onChoose(e.target.files?.[0]);
              e.target.value = ""; // choosing the same photo again still works
            }}
          />
        </label>
      </div>

      {photo && (
        <form action={removeAction}>
          <input type="hidden" name="itemId" value={itemId} />
          <button type="submit" disabled={pending} className={`${button} w-full`}>
            {removing ? "Removing…" : "Remove photo (use the emoji)"}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="font-medium">
          ⚠️ {error}
        </p>
      )}
      {saved?.ok && !pending && !error && (
        <p role="status" className="font-medium">
          ✓ Photo saved
        </p>
      )}
    </div>
  );
}

// The middle square of the photo, ITEM_PHOTO_SIDE pixels, as a JPEG under the size limit.
async function squarePhoto(file: File): Promise<Blob> {
  const image = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { x, y, side } = centerSquare(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = ITEM_PHOTO_SIDE;
    canvas.height = ITEM_PHOTO_SIDE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    context.drawImage(image, x, y, side, side, 0, 0, ITEM_PHOTO_SIDE, ITEM_PHOTO_SIDE);
    for (const quality of [0.82, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((done) =>
        canvas.toBlob(done, "image/jpeg", quality),
      );
      if (blob && blob.size <= MAX_ITEM_PHOTO_BYTES) return blob;
    }
    throw new Error("Photo too large");
  } finally {
    image.close();
  }
}
