import { describe, expect, it } from "vitest";
import { formatIngredient, matchKey, parseIngredient, parseIngredientLines } from "./ingredients";

const p = (line: string) => parseIngredient(line);

describe("parseIngredient", () => {
  it.each([
    ["2 cups flour", 2, "cup", "flour"],
    ["1 cup milk", 1, "cup", "milk"],
    ["1.5 lb chicken thighs", 1.5, "lb", "chicken thighs"],
    ["1 1/2 lb chicken thighs", 1.5, "lb", "chicken thighs"],
    ["1/2 tsp salt", 0.5, "tsp", "salt"],
    ["½ tsp salt", 0.5, "tsp", "salt"],
    ["1½ cups rice", 1.5, "cup", "rice"],
    ["2 Tbsp. olive oil", 2, "tbsp", "olive oil"],
    ["2 tablespoons olive oil", 2, "tbsp", "olive oil"],
    ["1 T butter", 1, "tbsp", "butter"],
    ["1 t vanilla", 1, "tsp", "vanilla"],
    ["8 fl oz broth", 8, "fl_oz", "broth"],
    ["16 ounces pasta", 16, "oz", "pasta"],
    ["500 g ground beef", 500, "g", "ground beef"],
    ["1 dozen eggs", 1, "dozen", "eggs"],
    ["2 cups of water", 2, "cup", "water"],
  ] as const)("%s", (line, quantity, unit, name) => {
    expect(p(line)).toEqual({ quantity, unit, name });
  });

  it("keeps counts without a unit", () => {
    expect(p("3 eggs")).toEqual({ quantity: 3, unit: null, name: "eggs" });
    expect(p("2 cloves garlic, minced")).toEqual({ quantity: 2, unit: null, name: "cloves garlic, minced" });
  });

  it("takes the low end of a range", () => {
    expect(p("2-3 cups spinach")).toEqual({ quantity: 2, unit: "cup", name: "spinach" });
    expect(p("1 to 2 tbsp honey")).toEqual({ quantity: 1, unit: "tbsp", name: "honey" });
  });

  it("keeps lines with no amount as written", () => {
    expect(p("salt to taste")).toEqual({ quantity: null, unit: null, name: "salt to taste" });
    expect(p("Fresh basil")).toEqual({ quantity: null, unit: null, name: "Fresh basil" });
  });

  it("doesn't take a word that only looks like a unit as the unit", () => {
    // "c" is short for cup, but "2 carrots" mustn't become "2 cups of arrots".
    expect(p("2 carrots")).toEqual({ quantity: 2, unit: null, name: "carrots" });
    expect(p("1 large onion")).toEqual({ quantity: 1, unit: null, name: "large onion" });
  });

  it("ignores list bullets and extra spaces, and skips blank lines", () => {
    expect(p("  - 2   cups   flour ")).toEqual({ quantity: 2, unit: "cup", name: "flour" });
    expect(p("• 1 lemon")).toEqual({ quantity: 1, unit: null, name: "lemon" });
    expect(p("   ")).toBeNull();
  });

  it("keeps a bare amount as text rather than inventing a name", () => {
    expect(p("2 cups")).toEqual({ quantity: null, unit: null, name: "2 cups" });
    expect(p("0 cups flour")).toEqual({ quantity: null, unit: null, name: "0 cups flour" });
  });
});

describe("parseIngredientLines and formatIngredient", () => {
  it("reads pasted lines and writes them back", () => {
    const parsed = parseIngredientLines("2 cups flour\n\n1 1/2 lb chicken thighs\r\nsalt to taste\n3 eggs");
    expect(parsed.map(formatIngredient)).toEqual([
      "2 cups flour",
      "1.5 lb chicken thighs",
      "salt to taste",
      "3 eggs",
    ]);
  });
});

describe("matchKey", () => {
  it("matches on the name before any comma or note", () => {
    expect(matchKey("Chicken thighs, boneless")).toBe("chicken thighs");
    expect(matchKey("rice (jasmine)")).toBe("rice");
    expect(matchKey("Eggs")).toBe("eggs");
  });
});
