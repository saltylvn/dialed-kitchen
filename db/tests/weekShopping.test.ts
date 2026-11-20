import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// From the meal plan to the grocery list, against real Postgres.

let db: TestDb;
let alex: TestUser;
let sam: TestUser; // Alex's spouse
let stranger: TestUser;

const WEEK = "2026-10-26"; // a Monday

beforeEach(async () => {
  db = await createTestDb();
  alex = await db.createUser("alex@example.com");
  sam = await db.createUser("sam@example.com");
  stranger = await db.createUser("stranger@example.com");
  await db.as(alex, "select public.create_household_invite($1, $2)", [sam.email, fakeTokenHash(1)]);
  await db.as(sam, "select public.accept_household_invite($1)", [fakeTokenHash(1)]);
});

type Ingredient = { quantity?: number; unit?: string; name: string; item_id?: string };

async function recipe(user: TestUser, title: string, servings: number, ingredients: Ingredient[]) {
  const { rows } = await db.as<{ id: string }>(
    user,
    "select public.save_recipe(null, $1, $2::smallint, 'own', null, null, '{}', $3) as id",
    [title, servings, JSON.stringify(ingredients)],
  );
  return rows[0]!.id;
}

const plan = (user: TestUser, recipeId: string, servings: number, date = WEEK, meal = "dinner") =>
  db.as(
    user,
    "insert into public.meal_plan_entries (plan_date, meal, recipe_id, servings) values ($1, $2, $3, $4)",
    [date, meal, recipeId, servings],
  );

type Row = {
  name: string;
  quantity: number | null;
  unit: string | null;
  in_stock: boolean;
  on_list: boolean;
  est_cost: number | null;
};
const shopping = async (user: TestUser, week = WEEK) =>
  (
    await db.as<Row>(
      user,
      "select name, quantity::float as quantity, unit, in_stock, on_list, est_cost::float as est_cost from public.week_shopping($1)",
      [week],
    )
  ).rows;

const addWeek = async (user: TestUser, week = WEEK) =>
  (await db.as<{ n: number }>(user, "select public.add_week_to_list($1) as n", [week])).rows[0]!.n;

const list = async (user: TestUser) =>
  (
    await db.as<{ name: string; quantity: number | null; unit: string | null; source: string }>(
      user,
      "select name, quantity::float as quantity, unit, source from public.grocery_list_items order by created_at, name",
    )
  ).rows;

async function item(user: TestUser, name: string, dimension: string, compareUnit: string) {
  const { rows } = await db.as<{ id: string }>(
    user,
    "insert into public.items (name, dimension, compare_unit) values ($1, $2, $3) returning id",
    [name, dimension, compareUnit],
  );
  return rows[0]!.id;
}

async function price(user: TestUser, itemId: string, amount: number, qty: number, unit: string) {
  const store = (await db.as<{ id: string }>(user, "select id from public.stores limit 1")).rows[0]!
    .id;
  await db.as(
    user,
    "insert into public.item_prices (item_id, store_id, price, package_quantity, package_unit, observed_on) values ($1, $2, $3, $4, $5, '2026-10-20')",
    [itemId, store, amount, qty, unit],
  );
}

describe("week_shopping", () => {
  it("scales each recipe to the servings planned", async () => {
    const chili = await recipe(alex, "Chili", 4, [
      { quantity: 2, unit: "lb", name: "ground beef" },
    ]);
    await plan(alex, chili, 2); // half the recipe
    expect(await shopping(sam)).toEqual([
      expect.objectContaining({ name: "ground beef", quantity: 1, unit: "lb" }),
    ]);
  });

  it("combines the same ingredient across meals, converting units of the same kind", async () => {
    const a = await recipe(alex, "Rice bowl", 2, [{ quantity: 1, unit: "cup", name: "rice" }]);
    const b = await recipe(alex, "Fried rice", 2, [
      { quantity: 8, unit: "tbsp", name: "Rice" }, // ½ cup
      { quantity: 2, name: "eggs" },
      { name: "salt to taste" },
    ]);
    await plan(alex, a, 2);
    await plan(alex, b, 2, "2026-10-27");
    await plan(alex, b, 2, "2026-10-28");
    expect(await shopping(alex)).toEqual([
      expect.objectContaining({ name: "rice", quantity: 2, unit: "cup" }),
      expect.objectContaining({ name: "eggs", quantity: 4, unit: null }),
      expect.objectContaining({ name: "salt to taste", quantity: null, unit: null }),
    ]);
  });

  it("keeps amounts that can't be converted apart, never guessing", async () => {
    const a = await recipe(alex, "A", 1, [
      { quantity: 1, unit: "cup", name: "spinach" },
      { quantity: 4, unit: "oz", name: "spinach" },
    ]);
    await plan(alex, a, 1);
    const rows = await shopping(alex);
    expect(rows.map((r) => [r.quantity, r.unit])).toEqual([
      [1, "cup"],
      [4, "oz"],
    ]);
  });

  it("only counts the chosen week", async () => {
    const a = await recipe(alex, "A", 1, [{ quantity: 1, unit: "each", name: "lemon" }]);
    await plan(alex, a, 1, "2026-10-25"); // the Sunday before
    await plan(alex, a, 1, "2026-11-02"); // the Monday after
    await plan(alex, a, 1, "2026-11-01"); // this week's Sunday
    expect((await shopping(alex)).map((r) => r.quantity)).toEqual([1]);
  });

  it("marks what's In stock or already on the list", async () => {
    const a = await recipe(alex, "A", 1, [
      { quantity: 1, unit: "lb", name: "Chicken thighs" },
      { quantity: 2, unit: "cup", name: "rice" },
      { quantity: 1, unit: "each", name: "onion" },
    ]);
    await plan(alex, a, 1);
    await db.as(alex, "select public.set_in_stock('Rice', true)");
    await db.as(
      sam,
      "insert into public.grocery_list_items (name) values ('chicken thighs, boneless')",
    );
    expect((await shopping(alex)).map((r) => [r.name, r.in_stock, r.on_list])).toEqual([
      ["Chicken thighs", false, true],
      ["rice", true, false],
      ["onion", false, false],
    ]);
  });

  it("estimates cost from the best price, only when the units convert", async () => {
    const beef = await item(alex, "Ground beef", "weight", "lb");
    const eggs = await item(alex, "Eggs", "count", "each");
    const milk = await item(alex, "Milk", "volume", "gal");
    await price(alex, beef, 5, 1, "lb"); // $5/lb
    await price(alex, beef, 8, 2, "lb"); // $4/lb: the best
    await price(alex, eggs, 3, 1, "dozen"); // $0.25 each
    await price(alex, milk, 4, 1, "gal");
    const a = await recipe(alex, "A", 1, [
      { quantity: 24, unit: "oz", name: "ground beef", item_id: beef }, // 1.5 lb → $6
      { quantity: 3, name: "eggs", item_id: eggs }, // bare count → $0.75
      { quantity: 1, unit: "lb", name: "milk", item_id: milk }, // weight vs volume: unknown
      { quantity: 1, unit: "each", name: "lime" }, // no price
    ]);
    await plan(alex, a, 1);
    expect((await shopping(alex)).map((r) => [r.name, r.est_cost])).toEqual([
      ["Ground beef", 6],
      ["Eggs", 0.75],
      ["Milk", null],
      ["lime", null],
    ]);
  });

  it("says where each ingredient is used, in week and meal order", async () => {
    const bowl = await recipe(alex, "Rice bowl", 2, [{ quantity: 1, unit: "cup", name: "rice" }]);
    const fried = await recipe(alex, "Fried rice", 2, [{ quantity: 1, unit: "cup", name: "rice" }]);
    await plan(alex, fried, 2, "2026-10-28", "dinner");
    await plan(alex, bowl, 2, "2026-10-28", "lunch"); // same day: lunch comes before dinner
    await plan(alex, bowl, 2, "2026-10-26", "dinner");
    const { rows } = await db.as<{ uses: { date: string; meal: string; recipe: string }[] }>(
      alex,
      "select uses from public.week_shopping($1)",
      [WEEK],
    );
    expect(rows[0]!.uses.map((u) => [u.date, u.meal, u.recipe])).toEqual([
      ["2026-10-26", "dinner", "Rice bowl"],
      ["2026-10-28", "lunch", "Rice bowl"],
      ["2026-10-28", "dinner", "Fried rice"],
    ]);
  });

  it("shows other households nothing", async () => {
    const a = await recipe(alex, "A", 1, [{ quantity: 1, unit: "each", name: "lemon" }]);
    await plan(alex, a, 1);
    expect(await shopping(stranger)).toEqual([]);
    expect(await addWeek(stranger)).toBe(0);
  });
});

describe("add_week_to_list", () => {
  it("adds what's needed once, from the meal plan, skipping In stock and what's on the list", async () => {
    const a = await recipe(alex, "A", 2, [
      { quantity: 1, unit: "lb", name: "pasta" },
      { quantity: 1, unit: "cup", name: "parmesan" },
      { quantity: 3, name: "cloves garlic" }, // a bare number
    ]);
    await plan(alex, a, 4); // double
    await db.as(alex, "select public.set_in_stock('parmesan', true)");

    expect(await addWeek(sam)).toBe(2);
    expect(await list(alex)).toEqual([
      { name: "cloves garlic", quantity: 6, unit: null, source: "meal_plan" },
      { name: "pasta", quantity: 2, unit: "lb", source: "meal_plan" },
    ]);
    expect(await addWeek(alex)).toBe(0); // running it again adds nothing
  });

  it("can't add to another household's list", async () => {
    const a = await recipe(alex, "A", 1, [{ quantity: 1, unit: "each", name: "lemon" }]);
    await plan(alex, a, 1);
    await addWeek(stranger);
    expect(await list(alex)).toEqual([]);
    expect(await list(stranger)).toEqual([]);
  });

  it("is closed to signed-out visitors", async () => {
    await expect(db.as(null, "select public.add_week_to_list('2026-10-26')")).rejects.toThrow(
      /permission denied/,
    );
  });
});
