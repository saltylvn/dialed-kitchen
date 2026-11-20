import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// Nutrition per serving on recipes, saved with the recipe in one step, against real Postgres.

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

const save = async (
  user: TestUser,
  nutrition: unknown,
  { id = null as string | null, title = "Chili", ingredients = [{ name: "beans" }] } = {},
) =>
  (
    await db.as<{ id: string }>(
      user,
      "select public.save_recipe($1, $2, 4::smallint, 'own', null, null, '{}', $3, $4) as id",
      [id, title, JSON.stringify(ingredients), JSON.stringify(nutrition)],
    )
  ).rows[0]!.id;

const nutritionOf = async (user: TestUser) =>
  (
    await db.as(
      user,
      "select calories, protein_g::float as protein, carbs_g::float as carbs, fat_g::float as fat from public.recipes",
    )
  ).rows;

describe("recipe nutrition", () => {
  it("saves with the recipe and is shared with the partner", async () => {
    await save(alex, { calories: 450, protein_g: 32.5, carbs_g: 40, fat_g: 12 });
    expect(await nutritionOf(sam)).toEqual([{ calories: 450, protein: 32.5, carbs: 40, fat: 12 }]);
  });

  it("is optional, value by value", async () => {
    await save(alex, { calories: 300 });
    expect(await nutritionOf(alex)).toEqual([
      { calories: 300, protein: null, carbs: null, fat: null },
    ]);
  });

  it("is replaced (or cleared) on edit", async () => {
    const id = await save(alex, { calories: 300, fat_g: 9 });
    await save(sam, { protein_g: 20 }, { id });
    expect(await nutritionOf(alex)).toEqual([
      { calories: null, protein: 20, carbs: null, fat: null },
    ]);
  });

  it("refuses impossible values, and then saves nothing at all", async () => {
    await expect(save(alex, { calories: 9000 })).rejects.toThrow(/check constraint/);
    await expect(save(alex, { protein_g: -1 })).rejects.toThrow(/check constraint/);
    await expect(save(alex, "lots")).rejects.toThrow(/Invalid nutrition/);
    expect((await db.as(alex, "select * from public.recipes")).rows).toEqual([]);
  });

  it("can't touch another household's recipe", async () => {
    const id = await save(alex, { calories: 300 });
    await expect(save(stranger, { calories: 1 }, { id })).rejects.toThrow(/Recipe not found/);
    await db.as(stranger, "update public.recipes set calories = 1");
    expect(await nutritionOf(alex)).toEqual([
      { calories: 300, protein: null, carbs: null, fat: null },
    ]);
  });

  it("keeps the older 8-argument save working (during a deploy)", async () => {
    await db.as(
      alex,
      "select public.save_recipe(null, 'Toast', 2::smallint, 'own', null, null, '{}', '[]')",
    );
    expect(await nutritionOf(alex)).toEqual([
      { calories: null, protein: null, carbs: null, fat: null },
    ]);
  });
});
