import { describe, expect, it } from "vitest";
import { HOME_TAB, tabFromParam } from "./tabs";

describe("tabFromParam", () => {
  it("returns the tab Settings was opened from", () => {
    expect(tabFromParam("grocery").href).toBe("/grocery");
    expect(tabFromParam("recipes").href).toBe("/recipes");
  });

  it("falls back to the first tab for anything else", () => {
    for (const bad of [undefined, "", "settings", "https://evil.example.com", ["grocery"]]) {
      expect(tabFromParam(bad)).toBe(HOME_TAB);
    }
  });
});
