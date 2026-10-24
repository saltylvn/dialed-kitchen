import { describe, expect, it } from "vitest";
import { cleanText, extractRecipe, pageTitle } from "./recipeImport";

const page = (...blocks: unknown[]) =>
  `<html><head><title>Ignored</title>${blocks
    .map(
      (b) =>
        `<script type="application/ld+json">${typeof b === "string" ? b : JSON.stringify(b)}</script>`,
    )
    .join("")}</head><body>…</body></html>`;

describe("extractRecipe", () => {
  it("reads a plain Recipe", () => {
    const html = page({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Lemon Chicken",
      recipeYield: "4 servings",
      recipeIngredient: ["1 1/2 lb chicken thighs", "1 lemon"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "Season the chicken." },
        { "@type": "HowToStep", text: "Roast for 25 minutes." },
      ],
      publisher: { "@type": "Organization", name: "Good Food" },
      nutrition: {
        "@type": "NutritionInformation",
        calories: "320 calories",
        proteinContent: "34 g",
      },
    });
    expect(extractRecipe(html)).toEqual({
      title: "Lemon Chicken",
      servings: 4,
      ingredients: ["1 1/2 lb chicken thighs", "1 lemon"],
      steps: ["Season the chicken.", "Roast for 25 minutes."],
      siteName: "Good Food",
      nutrition: { calories: 320, protein: 34, carbs: null, fat: null },
    });
  });

  it("finds the Recipe inside @graph, with @type as a list, among other blocks", () => {
    const html = page(
      { "@type": "BreadcrumbList", itemListElement: [] },
      {
        "@graph": [
          { "@type": "WebPage", name: "Page" },
          { "@type": ["Recipe", "NewsArticle"], name: "Tacos", recipeIngredient: ["1 lb beef"] },
        ],
      },
    );
    expect(extractRecipe(html)?.title).toBe("Tacos");
  });

  it("skips a broken block and keeps looking", () => {
    const html = page("{ not json", {
      "@type": "Recipe",
      name: "Soup",
      recipeIngredient: ["water"],
    });
    expect(extractRecipe(html)?.title).toBe("Soup");
  });

  it("handles sections, plain-string steps and HTML inside the text", () => {
    const html = page({
      "@type": "Recipe",
      name: "Mac &amp; Cheese",
      recipeYield: ["6", "6 servings"],
      recipeIngredient: ["2 cups <b>elbow</b> pasta", "1&frac12; cups milk", "salt &amp; pepper"],
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "Pasta",
          itemListElement: [{ "@type": "HowToStep", text: "Boil the pasta." }],
        },
        "Make the sauce.<br>Combine.",
      ],
    });
    expect(extractRecipe(html)).toMatchObject({
      title: "Mac & Cheese",
      servings: 6,
      ingredients: ["2 cups elbow pasta", "1½ cups milk", "salt & pepper"],
      steps: ["Boil the pasta.", "Make the sauce.", "Combine."],
    });
  });

  it("falls back to the page's site name", () => {
    const html =
      `<meta property="og:site_name" content="Kitchn">` +
      page({ "@type": "Recipe", name: "Pie", recipeIngredient: ["flour"] });
    expect(extractRecipe(html)?.siteName).toBe("Kitchn");
  });

  it("returns nothing when the page has no recipe data", () => {
    expect(extractRecipe("<html><body>Just a blog post</body></html>")).toBeNull();
    expect(extractRecipe(page({ "@type": "Article", name: "Not a recipe" }))).toBeNull();
  });

  it("keeps imported values within the app's limits", () => {
    const html = page({
      "@type": "Recipe",
      name: "x".repeat(300),
      recipeYield: "500",
      recipeIngredient: Array.from({ length: 300 }, (_, i) => `${i} eggs`),
    });
    const r = extractRecipe(html)!;
    expect(r.title).toHaveLength(120);
    expect(r.servings).toBe(50);
    expect(r.ingredients).toHaveLength(200);
  });
});

describe("cleanText and pageTitle", () => {
  it("decodes entities safely and strips tags", () => {
    expect(cleanText("Caf&eacute; &#8211; &#x2014; <i>nice</i>")).toBe("Café – — nice");
    expect(cleanText("bad &#99999999; ok")).toBe("bad ok");
    expect(cleanText(42)).toBe("");
  });

  it("reads the page title", () => {
    expect(pageTitle("<title> Best Tacos | Site </title>")).toBe("Best Tacos | Site");
    expect(pageTitle("<p>no title</p>")).toBeNull();
  });
});
