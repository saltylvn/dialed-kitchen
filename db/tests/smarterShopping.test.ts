import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type TestUser } from "./testDb";

// Smarter shopping (docs/decisions/0052): the cheapest price now, costing the week with it,
// and restocking from a receipt. Against real Postgres.

let db: TestDb;
let alex: TestUser;
let stranger: TestUser;
let stores: Record<string, string>;
let rice: string;

const WEEK = "2026-10-26"; // a Monday

beforeEach(async () => {
  db = await createTestDb();
  alex = await db.createUser("alex@example.com");
  stranger = await db.createUser("stranger@example.com");
  const { rows } = await db.as<{ id: string; name: string }>(
    alex,
    "select id, name from public.stores",
  );
  stores = Object.fromEntries(rows.map((s) => [s.name, s.id]));
  rice = (
    await db.as<{ id: string }>(
      alex,
      "insert into public.items (name, dimension, compare_unit) values ('Rice', 'weight', 'lb') returning id",
    )
  ).rows[0]!.id;
});

const price = (store: string, amount: number, day: string, itemId = rice) =>
  db.as(
    alex,
    "insert into public.item_prices (item_id, store_id, price, package_quantity, package_unit, observed_on) values ($1, $2, $3, 1, 'lb', $4)",
    [itemId, stores[store], amount, day],
  );

const cheapestNow = async (user: TestUser) =>
  (
    await db.as<{ store: string; per_lb: number }>(
      user,
      `select s.name as store, round(c.unit_price_base * 453.59237, 2)::float as per_lb
       from public.item_cheapest_now c join public.stores s on s.id = c.store_id`,
    )
  ).rows;

describe("item_cheapest_now", () => {
  it("uses each store's latest price, so an old sale no longer wins", async () => {
    await price("WinCo", 0.99, "2026-01-05"); // an old sale
    await price("WinCo", 1.79, "2026-10-01"); // WinCo today
    await price("Costco", 1.49, "2026-09-15");
    expect(await cheapestNow(alex)).toEqual([{ store: "Costco", per_lb: 1.49 }]);
    // The best price ever is still the old sale (the price book and "New best!" keep it).
    const best = await db.as<{ per_lb: number }>(
      alex,
      "select round(unit_price_base * 453.59237, 2)::float as per_lb from public.item_best_prices",
    );
    expect(best.rows).toEqual([{ per_lb: 0.99 }]);
  });

  it("is only the household's own", async () => {
    await price("WinCo", 1.79, "2026-10-01");
    expect(await cheapestNow(stranger)).toEqual([]);
  });
});

describe("week_shopping costs the week at today's cheapest price", () => {
  it("estimates with the cheapest latest price, not the best ever", async () => {
    await price("WinCo", 0.99, "2026-01-05");
    await price("WinCo", 2.0, "2026-10-01");
    await price("Costco", 1.5, "2026-09-15");
    const { rows } = await db.as<{ id: string }>(
      alex,
      "select public.save_recipe(null, 'Rice bowl', 2::smallint, 'own', null, null, '{}', $1) as id",
      [JSON.stringify([{ quantity: 2, unit: "lb", name: "Rice", item_id: rice }])],
    );
    await db.as(
      alex,
      "insert into public.meal_plan_entries (plan_date, meal, recipe_id, servings) values ($1, 'dinner', $2, 2)",
      [WEEK, rows[0]!.id],
    );
    const week = await db.as<{ est_cost: number }>(
      alex,
      "select est_cost::float as est_cost from public.week_shopping($1)",
      [WEEK],
    );
    expect(week.rows).toEqual([{ est_cost: 3 }]); // 2 lb × $1.50 (Costco), not × $0.99
  });
});

describe("restock", () => {
  const list = async (user: TestUser) =>
    (
      await db.as<{ name: string }>(
        user,
        "select name from public.grocery_list_items order by name",
      )
    ).rows.map((r) => r.name);
  const stock = async (user: TestUser) =>
    (
      await db.as<{ name: string }>(user, "select name from public.pantry_items order by name")
    ).rows.map((r) => r.name);

  it("puts what was bought In stock and takes it off the list", async () => {
    await db.as(
      alex,
      "insert into public.grocery_list_items (name) values ('Rice'), ('Bananas'), ('Milk')",
    );
    const { rows } = await db.as<{ n: number }>(alex, "select public.restock($1) as n", [
      ["Rice", "Milk", "Eggs", "rice"],
    ]);
    expect(rows[0]!.n).toBe(2);
    expect(await list(alex)).toEqual(["Bananas"]);
    expect(await stock(alex)).toEqual(["Eggs", "Milk", "Rice"]);
  });

  it("is harmless to repeat and ignores blanks", async () => {
    await db.as(alex, "select public.restock($1)", [["Rice", " ", ""]]);
    await db.as(alex, "select public.restock($1)", [["Rice"]]);
    expect(await stock(alex)).toEqual(["Rice"]);
  });

  it("touches only the caller's household", async () => {
    await db.as(stranger, "insert into public.grocery_list_items (name) values ('Rice')");
    await db.as(alex, "select public.restock($1)", [["Rice"]]);
    expect(await list(stranger)).toEqual(["Rice"]);
    expect(await stock(stranger)).toEqual([]);
  });

  it("refuses an oversized batch and signed-out callers", async () => {
    await expect(
      db.as(alex, "select public.restock($1)", [Array.from({ length: 201 }, (_, i) => `x${i}`)]),
    ).rejects.toThrow(/Too many items/);
    await expect(db.as(null, "select public.restock($1)", [["Rice"]])).rejects.toThrow(
      /permission denied/,
    );
  });
});
