import { describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// One entry per thing on the grocery list (decision 0038): the database refuses a second
// entry with the same name (private.ingredient_key), and the migration merges duplicates
// that were already there.

const MIGRATION = "20261109000000_list_one_entry_per_name.sql";

async function household(db: TestDb) {
  const alex = await db.createUser("alex@example.com");
  const sam = await db.createUser("sam@example.com");
  const stranger = await db.createUser("stranger@example.com");
  await db.as(alex, "select public.create_household_invite($1, $2)", [sam.email, fakeTokenHash(1)]);
  await db.as(sam, "select public.accept_household_invite($1)", [fakeTokenHash(1)]);
  return { alex, sam, stranger };
}

const add = (db: TestDb, user: TestUser, name: string, itemId: string | null = null) =>
  db.as(user, "insert into public.grocery_list_items (name, item_id) values ($1, $2)", [
    name,
    itemId,
  ]);

const names = async (db: TestDb, user: TestUser) =>
  (
    await db.as<{ name: string; checked: boolean }>(
      user,
      "select name, checked from public.grocery_list_items order by created_at, name",
    )
  ).rows;

describe("one entry per name", () => {
  it("refuses the same thing again, whatever the capitals or details after a comma", async () => {
    const db = await createTestDb();
    const { alex, sam } = await household(db);
    await add(db, alex, "Bananas");
    for (const again of ["Bananas", "bananas", "BANANAS", "Bananas, ripe", "bananas (organic)"]) {
      await expect(add(db, sam, again), again).rejects.toThrow(/duplicate key/);
    }
    expect(await names(db, alex)).toEqual([{ name: "Bananas", checked: false }]);
  });

  it("still allows different things, and the same thing in another household", async () => {
    const db = await createTestDb();
    const { alex, stranger } = await household(db);
    await add(db, alex, "Bananas");
    await add(db, alex, "Banana bread");
    await expect(add(db, stranger, "Bananas")).resolves.toBeDefined();
  });

  it("lets a recipe add only what isn't on the list yet", async () => {
    const db = await createTestDb();
    const { alex } = await household(db);
    await add(db, alex, "Garlic");
    const { rows } = await db.as<{ id: string }>(
      alex,
      "insert into public.recipes (title, servings) values ('Garlic rice', 2) returning id",
    );
    const recipe = rows[0]!.id;
    await db.as(
      alex,
      `insert into public.recipe_ingredients (recipe_id, name, sort_order)
       values ($1, 'garlic, minced', 1), ($1, 'Rice', 2)`,
      [recipe],
    );
    await db.as(alex, "select public.add_recipe_to_list($1)", [recipe]);
    expect((await names(db, alex)).map((r) => r.name)).toEqual(["Garlic", "Rice"]);
  });
});

describe("the migration", () => {
  it("merges duplicates (keeping the linked one, else the oldest) and un-ticks old kart entries", async () => {
    const db = await createTestDb({ stopBefore: MIGRATION });
    const { alex } = await household(db);
    const { rows } = await db.as<{ id: string }>(
      alex,
      "insert into public.items (name, dimension, compare_unit) values ('Milk', 'volume', 'gal') returning id",
    );
    const milk = rows[0]!.id;
    // Old data: the same thing twice, and ticked entries from the Shopping kart.
    await add(db, alex, "milk");
    await add(db, alex, "Milk", milk);
    await add(db, alex, "Eggs");
    await add(db, alex, "eggs");
    await db.as(alex, "update public.grocery_list_items set checked = true where name = 'Eggs'");
    await add(db, alex, "Rice");

    await db.migrateRest();

    const left = await db.as<{ name: string; item_id: string | null; checked: boolean }>(
      alex,
      "select name, item_id, checked from public.grocery_list_items order by name",
    );
    expect(left.rows).toEqual([
      { name: "Eggs", item_id: null, checked: false }, // the oldest, now un-ticked
      { name: "Milk", item_id: milk, checked: false }, // the linked one
      { name: "Rice", item_id: null, checked: false },
    ]);
    await expect(add(db, alex, "rice")).rejects.toThrow(/duplicate key/);
  });
});
