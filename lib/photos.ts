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

// ─── Item photos (docs/decisions/0029) ────────────────────────────────────────
// A small square photo shown in place of an item's emoji. The phone crops and shrinks it
// to ITEM_PHOTO_SIDE before sending; the database refuses anything over 100 KB.

export const ITEM_PHOTO_SIDE = 320; // pixels: sharp at icon size on a 3× screen, ~20 KB
export const MAX_ITEM_PHOTO_BYTES = 100_000;

export function checkItemPhoto(bytes: Uint8Array): PhotoCheck {
  if (bytes.length === 0) return { ok: false, error: "Choose a photo." };
  if (bytes.length > MAX_ITEM_PHOTO_BYTES) {
    return { ok: false, error: "That photo is too large. Try taking it again." };
  }
  if (!isJpeg(bytes)) {
    return { ok: false, error: "That file isn't a photo the app can read. Try another." };
  }
  return { ok: true };
}

// The centered square to cut from a photo: the whole short side, the middle of the long.
export function centerSquare(width: number, height: number) {
  const side = Math.min(width, height);
  return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), side };
}

// Where an item's photo is served, with its version so a replaced photo isn't cached.
export function itemPhotoSrc(itemId: string, updatedAt: string): string {
  return `/grocery/items/${itemId}/photo?v=${Date.parse(updatedAt) || 0}`;
}
