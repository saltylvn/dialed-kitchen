import { PHOTO_MAX_SIDE, scaledSize } from "@/lib/photos";

// Shrinking a photo on the phone before it's sent: quicker over cellular, cheaper for the AI,
// and redrawing it drops hidden photo data like GPS location. Used for recipe photos and
// receipts (receipts keep more pixels: their print is small).

const TARGET_BYTES = 1_200_000;

// Shrinks a photo to fit `maxSide` px on its longest side, as a JPEG under ~1.2 MB.
export async function shrinkPhoto(file: File, maxSide = PHOTO_MAX_SIDE): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = await decode(file, url);
    const { width, height } = scaledSize(image.width, image.height, maxSide);
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
