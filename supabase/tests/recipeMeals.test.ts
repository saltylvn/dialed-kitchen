import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// Which meals a recipe is for, saved with the recipe in one step, against real Postgres.

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

const save = async (user: TestUser, meals: string[], id: string | null = null) =>
  (
    await db.as<{ id: string }>(
      user,
      "select public.save_recipe($1, 'Oatmeal', 2::smallint, 'own', null, null, '{}', '[]', '{}', $2) as id",
      [id, meals],
    )
  ).rows[0]!.id;

const mealsOf = async (user: TestUser) =>
  (await db.as<{ meals: string[] }>(user, "select meals from public.recipes")).rows.map(
    (r) => r.meals,
  );

describe("recipe meals", () => {
  it("saves in meal order, each once, shared with the partner", async () => {
    await save(alex, ["dinner", "breakfast", "dinner"]);
    expect(await mealsOf(sam)).toEqual([["breakfast", "dinner"]]);
  });

  it("can be changed or cleared on edit", async () => {
    const id = await save(alex, ["lunch"]);
    await save(sam, ["snacks", "lunch"], id);
    expect(await mealsOf(alex)).toEqual([["lunch", "snacks"]]);
    await save(alex, [], id);
    expect(await mealsOf(alex)).toEqual([[]]);
  });

  it("starts empty (not sorted yet) for recipes saved the older ways", async () => {
    await db.as(
      alex,
      "select public.save_recipe(null, 'Toast', 2::smallint, 'own', null, null, '{}', '[]')",
    );
    expect(await mealsOf(alex)).toEqual([[]]);
  });

  it("refuses anything but the four meals, and then saves nothing", async () => {
    await expect(save(alex, ["brunch"])).rejects.toThrow(/Invalid meal/);
    expect(await mealsOf(alex)).toEqual([]);
  });

  it("is checked by the table too", async () => {
    await save(alex, ["lunch"]);
    await expect(db.as(alex, "update public.recipes set meals = '{supper}'")).rejects.toThrow(
      /check constraint/,
    );
  });

  it("can't touch another household's recipe", async () => {
    const id = await save(alex, ["lunch"]);
    await expect(save(stranger, ["dinner"], id)).rejects.toThrow(/Recipe not found/);
    expect(await mealsOf(alex)).toEqual([["lunch"]]);
  });
});
