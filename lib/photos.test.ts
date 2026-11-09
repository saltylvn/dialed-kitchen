import { describe, expect, it } from "vitest";
import { checkPhotos, isJpeg, MAX_PHOTO_BYTES, scaledSize } from "./photos";

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
