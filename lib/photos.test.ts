import { describe, expect, it } from "vitest";
import {
  centerSquare,
  checkItemPhoto,
  checkPhotos,
  isJpeg,
  MAX_ITEM_PHOTO_BYTES,
  MAX_PHOTO_BYTES,
  scaledSize,
} from "./photos";

const jpeg = (size = 100) => {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return bytes;
};

describe("isJpeg", () => {
  it("goes by the file's first bytes, not its name or claimed type", () => {
    expect(isJpeg(jpeg())).toBe(true);
    expect(isJpeg(new TextEncoder().encode("<svg onload=alert(1)>"))).toBe(false);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false); // PNG
    expect(isJpeg(new Uint8Array([0xff, 0xd8]))).toBe(false);
  });
});

describe("checkPhotos", () => {
  it("accepts one to three JPEGs", () => {
    expect(checkPhotos([jpeg()])).toEqual({ ok: true });
    expect(checkPhotos([jpeg(), jpeg(), jpeg()])).toEqual({ ok: true });
  });

  it("refuses none, too many, too large, or not a JPEG", () => {
    expect(checkPhotos([]).ok).toBe(false);
    expect(checkPhotos([jpeg(), jpeg(), jpeg(), jpeg()]).ok).toBe(false);
    expect(checkPhotos([jpeg(MAX_PHOTO_BYTES + 1)]).ok).toBe(false);
    expect(checkPhotos([jpeg(), new Uint8Array(100)]).ok).toBe(false);
  });
});

describe("scaledSize", () => {
  it("shrinks the longest side to fit, keeping the shape", () => {
    expect(scaledSize(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("never enlarges a small photo", () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("checkItemPhoto", () => {
  const jpeg = (size: number) => new Uint8Array([0xff, 0xd8, 0xff, ...new Array(size - 3).fill(0)]);

  it("accepts a small JPEG", () => {
    expect(checkItemPhoto(jpeg(20_000))).toEqual({ ok: true });
  });

  it("refuses an empty file, a large one, and anything that isn't a JPEG", () => {
    expect(checkItemPhoto(new Uint8Array()).ok).toBe(false);
    expect(checkItemPhoto(jpeg(MAX_ITEM_PHOTO_BYTES + 1)).ok).toBe(false);
    expect(checkItemPhoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47])).ok).toBe(false); // PNG
  });
});

describe("centerSquare", () => {
  it("takes the middle of a tall photo", () => {
    expect(centerSquare(3000, 4000)).toEqual({ x: 0, y: 500, side: 3000 });
  });

  it("takes the middle of a wide photo", () => {
    expect(centerSquare(4000, 3000)).toEqual({ x: 500, y: 0, side: 3000 });
  });

  it("keeps a square photo whole", () => {
    expect(centerSquare(1000, 1000)).toEqual({ x: 0, y: 0, side: 1000 });
  });
});
