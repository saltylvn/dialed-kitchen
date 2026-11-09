import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOME_TAB, TABS, tabFromParam } from "./tabs";

describe("TABS", () => {
  it("is Recipes, Plan, Grocery: Plan in the middle", () => {
    expect(TABS.map((t) => t.label)).toEqual(["Recipes", "Plan", "Grocery"]);
  });
});

describe("HOME_TAB", () => {
  it("is Plan, where the app opens", () => {
    expect(HOME_TAB.href).toBe("/plan");
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
