import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../app/manifest";
import { ICON_VERSION } from "./iconVersion";

// Guards the home-screen icon setup that iPhones are picky about.

const PUBLIC = new URL("../public/", import.meta.url);

function pngInfo(file: string) {
  const png = readFileSync(new URL(file, PUBLIC));
  const chunks: string[] = [];
  for (let o = 8; o < png.length; o += 12 + png.readUInt32BE(o)) {
    chunks.push(png.toString("ascii", o + 4, o + 8));
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), chunks };
}

describe("app icon files", () => {
  it.each([
    ["apple-touch-icon.png", 180],
    ["apple-touch-icon-precomposed.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
  ])("%s is a %ipx square PNG with no extra metadata", (file, size) => {
    const { width, height, chunks } = pngInfo(file);
    expect([width, height]).toEqual([size, size]);
    expect(chunks).toEqual(["IHDR", "IDAT", "IEND"]);
  });

  it("is listed in the manifest with the current version, iPhone size first", () => {
    const icons = manifest().icons ?? [];
    expect(icons[0]).toMatchObject({
      src: `/apple-touch-icon.png?v=${ICON_VERSION}`,
      sizes: "180x180",
    });
    for (const icon of icons) {
      expect(existsSync(new URL(icon.src.split("?")[0]!.slice(1), PUBLIC)), icon.src).toBe(true);
    }
  });
});
