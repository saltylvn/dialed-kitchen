// Rules for recipe photos sent to the server (docs/decisions/0016). The phone shrinks each
// photo to a JPEG first (features/recipes/components/PhotoImport), so anything else is
// refused: the server never trusts the file name or the type the browser claims.

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 1_500_000; // the phone aims for ~1.2 MB; a little headroom
export const PHOTO_MAX_SIDE = 1600; // pixels: plenty to read small print, quick to send

// Every JPEG file starts with these three bytes, whatever its name says.
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export type PhotoCheck = { ok: true } | { ok: false; error: string };

export function checkPhotos(photos: readonly Uint8Array[]): PhotoCheck {
  if (photos.length === 0) return { ok: false, error: "Choose a photo of the recipe." };
  if (photos.length > MAX_PHOTOS) {
    return { ok: false, error: `Choose up to ${MAX_PHOTOS} photos of one recipe.` };
  }
  if (photos.some((p) => p.length > MAX_PHOTO_BYTES)) {
    return { ok: false, error: "That photo is too large. Try taking it again." };
  }
  if (!photos.every(isJpeg)) {
    return { ok: false, error: "That file isn't a photo the app can read. Try another." };
  }
  return { ok: true };
}

// Fits a photo inside PHOTO_MAX_SIDE, keeping its shape. Never enlarges.
export function scaledSize(width: number, height: number, maxSide = PHOTO_MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
