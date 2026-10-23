import { beforeEach, describe, expect, it } from "vitest";
import { matchKey } from "../../lib/ingredients";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// "In stock", kept in step with the grocery list and recipes, against real Postgres.

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

const setInStock = async (user: TestUser, name: string, inStock = true) => {
  const { rows } = await db.as<{ n: number }>(user, "select public.set_in_stock($1, $2) as n", [
    name,
    inStock,
  ]);
  return rows[0]!.n;
};
const inStock = async (user: TestUser) =>
  (await db.as<{ key: string }>(user, "select key from public.pantry_items order by key")).rows.map(
    (r) => r.key,
  );
const list = async (user: TestUser) =>
  (
    await db.as<{ name: string; checked: boolean }>(
      user,
      "select name, checked from public.grocery_list_items order by created_at, name",
    )
  ).rows;
const addToList = (user: TestUser, name: string, checked = false) =>
  db
    .as(user, "insert into public.grocery_list_items (name) values ($1) returning id", [name])
    .then(async (r) => {
      if (checked) {
        await db.as(user, "update public.grocery_list_items set checked = true where id = $1", [
          (r.rows[0] as { id: string }).id,
        ]);
      }
    });

describe("matching names", () => {
  it("uses the same rule in SQL as lib/ingredients", async () => {
    for (const name of [
      "Chicken thighs, boneless",
      "rice (jasmine)",
      "Eggs",
      "(optional) parsley",
      "  Olive oil ",
    ]) {
      const { rows } = await db.admin<{ k: string }>("select private.ingredient_key($1) as k", [
        name,
      ]);
      expect(rows[0]!.k, name).toBe(matchKey(name));
    }
  });
});

describe("marking In stock", () => {
  it("records it once for the household and takes it off the list (not bought entries only)", async () => {
    await addToList(alex, "Chicken thighs");
    await addToList(alex, "chicken thighs, boneless", true); // already bought: stays until cleared
    await addToList(alex, "Rice");

    expect(await setInStock(sam, "chicken thighs, boneless")).toBe(1);
    await setInStock(sam, "Chicken Thighs"); // same thing: not recorded twice

    expect(await inStock(alex)).toEqual(["chicken thighs"]);
    expect(await list(alex)).toEqual([
      { name: "chicken thighs, boneless", checked: true },
      { name: "Rice", checked: false },
    ]);
  });

  it("can be undone when something is used up", async () => {
    await setInStock(alex, "Olive oil");
    await setInStock(sam, "olive oil", false);
    expect(await inStock(alex)).toEqual([]);
  });

  it("is private to the household", async () => {
    await setInStock(alex, "Saffron");
    await addToList(stranger, "Saffron");
    expect(await inStock(stranger)).toEqual([]);
    // Alex marking it In stock again never touches the stranger's list.
    expect(await setInStock(alex, "Saffron")).toBe(0);
    expect(await list(stranger)).toEqual([{ name: "Saffron", checked: false }]);
    await expect(
      db.as(stranger, "delete from public.pantry_items returning id"),
    ).resolves.toMatchObject({ rows: [] });
  });

  it("won't let the app set the key or the household itself", async () => {
    await expect(
      db.as(alex, "insert into public.pantry_items (name, key) values ('a', 'b')"),
    ).rejects.toThrow(/permission denied|cannot insert/);
  });
});

describe("after shopping", () => {
  it("clearing bought items puts them In stock and leaves the rest on the list", async () => {
    await addToList(alex, "Milk", true);
    await addToList(alex, "Eggs", true);
    await addToList(alex, "Bread");
    const { rows } = await db.as<{ n: number }>(
      sam,
      "select public.clear_checked_into_stock() as n",
    );
    expect(rows[0]!.n).toBe(2);
    expect(await inStock(alex)).toEqual(["eggs", "milk"]);
    expect(await list(alex)).toEqual([{ name: "Bread", checked: false }]);
  });
});

describe("recipes add only what's needed", () => {
  it("skips ingredients that are In stock", async () => {
    const { rows } = await db.as<{ id: string }>(
      alex,
      `select public.save_recipe(null, 'Lemon chicken', 2::smallint, 'own', null, null, '{}',
         '[{"quantity":1.5,"unit":"lb","name":"chicken thighs, boneless"},{"name":"salt"},{"quantity":1,"name":"lemon"}]') as id`,
    );
    await setInStock(sam, "Salt");
    await setInStock(sam, "Chicken thighs");
    const added = await db.as<{ n: number }>(alex, "select public.add_recipe_to_list($1) as n", [
      rows[0]!.id,
    ]);
    expect(added.rows[0]!.n).toBe(1);
    expect(await list(alex)).toEqual([{ name: "lemon", checked: false }]);
  });
});
