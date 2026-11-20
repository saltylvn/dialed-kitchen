import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// The weekly meal plan, against real Postgres.

let db: TestDb;
let alex: TestUser;
let sam: TestUser; // Alex's spouse
let stranger: TestUser;
let tacos: string;

beforeEach(async () => {
  db = await createTestDb();
  alex = await db.createUser("alex@example.com");
  sam = await db.createUser("sam@example.com");
  stranger = await db.createUser("stranger@example.com");
  await db.as(alex, "select public.create_household_invite($1, $2)", [sam.email, fakeTokenHash(1)]);
  await db.as(sam, "select public.accept_household_invite($1)", [fakeTokenHash(1)]);
  tacos = await recipe(alex, "Tacos");
});

async function recipe(user: TestUser, title: string) {
  const { rows } = await db.as<{ id: string }>(
    user,
    "select public.save_recipe(null, $1, 4::smallint, 'own', null, null, '{}', '[]') as id",
    [title],
  );
  return rows[0]!.id;
}

const plan = (
  user: TestUser,
  recipeId: string,
  meal = "dinner",
  date = "2026-10-26",
  servings = 4,
) =>
  db.as<{ id: string }>(
    user,
    "insert into public.meal_plan_entries (plan_date, meal, recipe_id, servings) values ($1, $2, $3, $4) returning id",
    [date, meal, recipeId, servings],
  );

const entries = async (user: TestUser) =>
  (await db.as<{ meal: string }>(user, "select meal from public.meal_plan_entries order by meal"))
    .rows;

describe("meal_plan_entries", () => {
  it("is shared by the couple", async () => {
    await plan(alex, tacos);
    await plan(sam, tacos, "lunch");
    expect(await entries(alex)).toEqual([{ meal: "dinner" }, { meal: "lunch" }]);
    expect(await entries(sam)).toHaveLength(2);
  });

  it("is invisible and untouchable to anyone else", async () => {
    const { rows } = await plan(alex, tacos);
    expect(await entries(stranger)).toEqual([]);
    await db.as(stranger, "delete from public.meal_plan_entries where id = $1", [rows[0]!.id]);
    expect(await entries(alex)).toHaveLength(1);
  });

  it("can't point at someone else's recipe", async () => {
    const theirs = await recipe(stranger, "Secret stew");
    await expect(plan(alex, theirs)).rejects.toThrow(/foreign key/);
  });

  it("allows only the four meals, sensible servings and dates", async () => {
    await expect(plan(alex, tacos, "brunch")).rejects.toThrow(/check/);
    await expect(plan(alex, tacos, "dinner", "2026-10-26", 0)).rejects.toThrow(/check/);
    await expect(plan(alex, tacos, "dinner", "1999-01-01")).rejects.toThrow(/check/);
  });

  it("leaves the plan when the recipe is deleted", async () => {
    await plan(alex, tacos);
    await db.as(alex, "delete from public.recipes where id = $1", [tacos]);
    expect(await entries(alex)).toEqual([]);
  });

  it("can't be moved to another household or forged", async () => {
    const { rows } = await plan(alex, tacos);
    await expect(
      db.as(
        alex,
        "update public.meal_plan_entries set household_id = gen_random_uuid() where id = $1",
        [rows[0]!.id],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(
        stranger,
        "insert into public.meal_plan_entries (household_id, plan_date, meal, recipe_id, servings) select household_id, '2026-10-26', 'dinner', id, 4 from public.recipes limit 1",
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("stops runaway inserts on one day", async () => {
    for (let i = 0; i < 20; i++) await plan(alex, tacos);
    await expect(plan(alex, tacos)).rejects.toThrow(/Too many meals that day/);
    await plan(alex, tacos, "dinner", "2026-10-27"); // other days are fine
  });

  it("is closed to signed-out visitors", async () => {
    await expect(db.as(null, "select * from public.meal_plan_entries")).rejects.toThrow(
      /permission denied/,
    );
  });
});
