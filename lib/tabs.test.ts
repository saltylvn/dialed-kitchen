import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOME_TAB, TABS, tabFromParam } from "./tabs";

describe("TABS", () => {
  it("is Plan, Grocery, Recipes: Grocery in the middle", () => {
    expect(TABS.map((t) => t.label)).toEqual(["Plan", "Grocery", "Recipes"]);
  });
});

describe("HOME_TAB", () => {
  it("is Grocery, where the app opens", () => {
    expect(HOME_TAB.href).toBe("/grocery");
  });

  it("matches the home-screen start_url", () => {
    const manifest = readFileSync("app/manifest.ts", "utf8");
    expect(manifest).toContain(`start_url: "${HOME_TAB.href}"`);
  });
});

describe("tabFromParam", () => {
  it("returns the tab Settings was opened from", () => {
    expect(tabFromParam("grocery").href).toBe("/grocery");
    expect(tabFromParam("recipes").href).toBe("/recipes");
  });

  it("falls back to the home tab for anything else", () => {
    for (const bad of [undefined, "", "settings", "https://evil.example.com", ["grocery"]]) {
      expect(tabFromParam(bad)).toBe(HOME_TAB);
    }
  });
});
