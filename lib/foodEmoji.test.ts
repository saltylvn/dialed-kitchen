import { describe, expect, it } from "vitest";
import { foodEmoji, singular } from "./foodEmoji";

describe("foodEmoji", () => {
  it("finds the food in everyday names", () => {
    const cases: [string, string][] = [
      ["Chicken thighs", "🍗"],
      ["ground beef", "🥩"],
      ["Eggs", "🥚"],
      ["2% milk", "🥛"],
      ["cheddar cheese, shredded", "🧀"],
      ["Bread flour", "🌾"],
      ["long grain rice", "🍚"],
      ["Tomatoes (diced)", "🍅"],
      ["fresh blueberries", "🫐"],
      ["Bananas", "🍌"],
      ["NAVAJO TACOS", "🌮"],
    ];
    for (const [name, emoji] of cases) expect(foodEmoji(name), name).toBe(emoji);
  });

  it("lets the main (last) food word win", () => {
    expect(foodEmoji("chicken broth")).toBe("🍲");
    expect(foodEmoji("garlic salt")).toBe("🧂");
    expect(foodEmoji("tomato sauce")).toBe("🥫");
    expect(foodEmoji("salt to taste")).toBe("🧂");
  });

  it("knows two-word foods", () => {
    expect(foodEmoji("creamy peanut butter")).toBe("🥜");
    expect(foodEmoji("red bell peppers")).toBe("🫑");
    expect(foodEmoji("crushed red pepper flakes")).toBe("🌶️");
    expect(foodEmoji("extra virgin olive oil")).toBe("🫒");
    expect(foodEmoji("sweet potatoes")).toBe("🍠");
    expect(foodEmoji("semi-sweet chocolate chips")).toBe("🍫");
  });

  it("leaves names that already have an emoji alone", () => {
    expect(foodEmoji("Roma Tomato 🍅")).toBeNull();
    expect(foodEmoji("Tacos 🌮")).toBeNull();
  });

  it("knows grooming and cleaning things too (decision 0058)", () => {
    expect(foodEmoji("Disposable razors")).toBe("🪒");
    expect(foodEmoji("Shaving cream")).toBe("🪒");
    expect(foodEmoji("Toothpaste")).toBe("🪥");
    expect(foodEmoji("Paper towels")).toBe("🧻");
    expect(foodEmoji("Dish soap")).toBe("🧽");
  });

  it("shows nothing rather than guessing", () => {
    expect(foodEmoji("aluminum foil")).toBeNull();
    expect(foodEmoji("")).toBeNull();
    expect(foodEmoji("1 1/2")).toBeNull();
  });
});

describe("singular", () => {
  it("handles common plurals", () => {
    expect(["tomatoes", "berries", "peaches", "eggs", "swiss", "oats"].map(singular)).toEqual([
      "tomato",
      "berry",
      "peach",
      "egg",
      "swiss",
      "oat",
    ]);
  });
});
