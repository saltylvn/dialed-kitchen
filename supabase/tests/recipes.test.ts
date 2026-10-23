import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// Recipes, saving them in one step, and adding them to the grocery list, against real Postgres.

let db: TestDb;
let alex: TestUser;
let sam: TestUser; // Alex's spouse
let stranger: TestUser;

beforeEach(async () => {
  db = await createTestDb();
  alex = await db.createUser("alex@example.com");
  sam = await db.createUser("sam@example.com");
  stranger = await db.createUser("stranger@example.com");
  await db.as(alex, "select public.create_household_invite($1, $2)", [sam.email, fakeTokenHash(1)]);
  await db.as(sam, "select public.accept_household_invite($1)", [fakeTokenHash(1)]);
});

type Ingredient = {
  quantity?: number | null;
  unit?: string | null;
  name: string;
  item_id?: string | null;
};

async function save(
  user: TestUser,
  recipe: {
    id?: string | null;
    title: string;
    servings?: number;
    steps?: string[];
    ingredients: Ingredient[];
  },
): Promise<string> {
  const { rows } = await db.as<{ id: string }>(
    user,
    "select public.save_recipe($1, $2, $3, 'own', null, null, $4, $5) as id",
    [
      recipe.id ?? null,
      recipe.title,
      recipe.servings ?? 4,
      recipe.steps ?? [],
      JSON.stringify(recipe.ingredients),
    ],
  );
  return rows[0]!.id;
}

async function ingredients(user: TestUser, recipeId: string) {
  const { rows } = await db.as<{ name: string; quantity: number | null; unit: string | null }>(
    user,
    "select name, quantity::float as quantity, unit from public.recipe_ingredients where recipe_id = $1 order by sort_order",
    [recipeId],
  );
  return rows;
}

async function addItem(user: TestUser, name: string) {
  const { rows } = await db.as<{ id: string }>(
    user,
    "insert into public.items (name, dimension, compare_unit) values ($1, 'weight', 'lb') returning id",
    [name],
  );
  return rows[0]!.id;
}

describe("saving recipes", () => {
  it("saves a recipe with its ingredients in order, shared with the partner", async () => {
    const id = await save(alex, {
      title: "Chicken and rice",
      steps: ["Cook the rice.", "Sear the chicken."],
      ingredients: [
        { quantity: 1.5, unit: "lb", name: "chicken thighs" },
        { quantity: 2, unit: "cup", name: "rice" },
        { name: "salt to taste" },
      ],
    });
    expect(await ingredients(sam, id)).toEqual([
      { name: "chicken thighs", quantity: 1.5, unit: "lb" },
      { name: "rice", quantity: 2, unit: "cup" },
      { name: "salt to taste", quantity: null, unit: null },
    ]);
    const { rows } = await db.as<{ steps: string[] }>(sam, "select steps from public.recipes");
    expect(rows[0]!.steps).toEqual(["Cook the rice.", "Sear the chicken."]);
  });

  it("replaces the ingredients when a recipe is edited", async () => {
    const id = await save(alex, {
      title: "Pasta",
      ingredients: [{ name: "pasta" }, { name: "sauce" }],
    });
    await save(sam, {
      id,
      title: "Pasta night",
      ingredients: [{ quantity: 1, unit: "lb", name: "pasta" }],
    });
    expect(await ingredients(alex, id)).toEqual([{ name: "pasta", quantity: 1, unit: "lb" }]);
  });

  it("saves nothing at all when any part is invalid", async () => {
    await expect(
      save(alex, {
        title: "Bad",
        ingredients: [{ name: "ok" }, { quantity: 1, unit: "pints", name: "milk" }],
      }),
    ).rejects.toThrow(/check constraint/);
    expect((await db.as(alex, "select * from public.recipes")).rows).toEqual([]);
  });

  it("hides recipes from other households, and won't let them edit or link into yours", async () => {
    const id = await save(alex, { title: "Secret sauce", ingredients: [{ name: "love" }] });
    expect((await db.as(stranger, "select * from public.recipes")).rows).toEqual([]);
    expect((await db.as(stranger, "select * from public.recipe_ingredients")).rows).toEqual([]);
    await expect(save(stranger, { id, title: "Hacked", ingredients: [] })).rejects.toThrow(
      /Recipe not found/,
    );
    const theirItem = await addItem(alex, "Rice");
    await expect(
      save(stranger, { title: "Mine", ingredients: [{ name: "rice", item_id: theirItem }] }),
    ).rejects.toThrow(/foreign key/);
  });

  it("rejects bad titles, servings, URLs and blank steps", async () => {
    await expect(save(alex, { title: " ", ingredients: [] })).rejects.toThrow(/check constraint/);
    await expect(save(alex, { title: "X", servings: 0, ingredients: [] })).rejects.toThrow(
      /check constraint/,
    );
    await expect(save(alex, { title: "X", steps: ["Stir", ""], ingredients: [] })).rejects.toThrow(
      /check constraint/,
    );
    await expect(
      db.as(
        alex,
        "select public.save_recipe(null, 'X', 4::smallint, 'website', 'Site', 'http://insecure.example', '{}', '[]')",
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("lets either partner star a favorite", async () => {
    const id = await save(alex, { title: "Tacos", ingredients: [] });
    await db.as(sam, "update public.recipes set favorite = true where id = $1", [id]);
    expect((await db.as(alex, "select favorite from public.recipes")).rows).toEqual([
      { favorite: true },
    ]);
  });
});

describe("adding a recipe to the grocery list", () => {
  it("adds every ingredient, linked ones by their price-book name, and skips ones already on the list", async () => {
    const rice = await addItem(alex, "Rice");
    const id = await save(alex, {
      title: "Rice bowl",
      ingredients: [
        { quantity: 2, unit: "cup", name: "rice, rinsed", item_id: rice },
        { quantity: 1, name: "avocado" },
      ],
    });
    const first = await db.as<{ n: number }>(sam, "select public.add_recipe_to_list($1) as n", [
      id,
    ]);
    expect(first.rows[0]!.n).toBe(2);
    const list = await db.as<{ name: string; quantity: number; unit: string | null }>(
      alex,
      "select name, quantity::float as quantity, unit from public.grocery_list_items order by created_at, name",
    );
    expect(list.rows).toEqual(
      expect.arrayContaining([
        { name: "Rice", quantity: 2, unit: "cup" },
        { name: "avocado", quantity: 1, unit: null },
      ]),
    );

    // Again: Rice is already on the list, so only the plain avocado line is added.
    const second = await db.as<{ n: number }>(alex, "select public.add_recipe_to_list($1) as n", [
      id,
    ]);
    expect(second.rows[0]!.n).toBe(1);
  });

  it("won't add another household's recipe", async () => {
    const id = await save(alex, { title: "Ours", ingredients: [{ name: "x" }] });
    await expect(db.as(stranger, "select public.add_recipe_to_list($1)", [id])).rejects.toThrow(
      /Recipe not found/,
    );
  });
});
