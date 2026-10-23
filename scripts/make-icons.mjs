// Renders assets/app-icon.svg into the plain PNG files phones and browsers use:
//   apple-touch-icon.png (180, iPhone home screen) + a "-precomposed" copy older iOS asks for,
//   icon-192.png and icon-512.png (web app manifest, browser tabs).
// Run `npm run icons` after changing the SVG, bump ICON_VERSION in lib/iconVersion.ts so
// phones fetch the new files, and commit the PNGs.
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const svg = readFileSync(new URL("../assets/app-icon.svg", import.meta.url), "utf8");

const OUTPUTS = [
  ["apple-touch-icon.png", 180],
  ["apple-touch-icon-precomposed.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
];

for (const [file, size] of OUTPUTS) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(new URL(`../public/${file}`, import.meta.url), png);
  console.log(`public/${file}  ${size}×${size}  ${png.length} bytes`);
}
