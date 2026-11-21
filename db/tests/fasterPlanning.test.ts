import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// Faster planning (docs/decisions/0053): leftovers, repeating a week, the weekly budget.

let db: TestDb;
let alex: TestUser;
let sam: TestUser; // Alex's spouse
let stranger: TestUser;
let chili: string;
let oats: string;

const LAST = "2026-11-16"; // a Monday
const NEXT = "2026-11-23";

beforeEach(async () => {
  db = await createTestDb();
  alex = await db.createUser("alex@example.com");
  sam = await db.createUser("sam@example.com");
  stranger = await db.createUser("stranger@example.com");
  await db.as(alex, "select public.create_household_invite($1, $2)", [sam.email, fakeTokenHash(1)]);
  await db.as(sam, "select public.accept_household_invite($1)", [fakeTokenHash(1)]);
  chili = await recipe(alex, "Chili");
  oats = await recipe(alex, "Oats");
});

async function recipe(user: TestUser, title: string) {
  const { rows } = await db.as<{ id: string }>(
    user,
    "select public.save_recipe(null, $1, 4::smallint, 'own', null, null, '{}', '[]') as id",
    [title],
  );
  return rows[0]!.id;
}

async function plan(user: TestUser, recipeId: string, date: string, meal = "dinner") {
  const { rows } = await db.as<{ id: string }>(
    user,
    "insert into public.meal_plan_entries (plan_date, meal, recipe_id, servings) values ($1, $2, $3, 4) returning id",
    [date, meal, recipeId],
  );
  return rows[0]!.id;
}

const leftovers = (user: TestUser, source: string, day: string, meal = "lunch") =>
  db.as<{ id: string }>(user, "select public.plan_leftovers($1, $2, $3, 2::smallint) as id", [
    source,
    day,
    meal,
  ]);

type Row = {
  plan_date: string;
  meal: string;
  title: string;
  servings: number;
  leftover: string | null;
};
const week = async (user: TestUser, monday: string) =>
  (
    await db.as<Row>(
      user,
      `select to_char(e.plan_date, 'YYYY-MM-DD') as plan_date, e.meal, r.title, e.servings,
              (select r2.title || ' ' || to_char(s.plan_date, 'MM-DD')
                 from public.meal_plan_entries s join public.recipes r2 on r2.id = s.recipe_id
                 where s.id = e.leftover_of) as leftover
       from public.meal_plan_entries e join public.recipes r on r.id = e.recipe_id
       where e.plan_date between $1::date and $1::date + 6
       order by e.plan_date, e.meal`,
      [monday],
    )
  ).rows;

describe("plan_leftovers", () => {
  it("plans the same recipe later, linked back to the meal", async () => {
    const monday = await plan(alex, chili, LAST);
    await leftovers(alex, monday, "2026-11-17");
    expect(await week(sam, LAST)).toEqual([
      { plan_date: LAST, meal: "dinner", title: "Chili", servings: 4, leftover: null },
      {
        plan_date: "2026-11-17",
        meal: "lunch",
        title: "Chili",
        servings: 2,
        leftover: "Chili 11-16",
      },
    ]);
  });

  it("only within the week after the meal, and only your household's meals", async () => {
    const monday = await plan(alex, chili, LAST);
    await expect(leftovers(alex, monday, "2026-11-15")).rejects.toThrow(/within a week/);
    await expect(leftovers(alex, monday, "2026-11-23")).rejects.toThrow(/within a week/);
    await expect(leftovers(stranger, monday, "2026-11-17")).rejects.toThrow(/Meal not found/);
  });

  it("stay planned as an ordinary meal when the original is removed", async () => {
    const monday = await plan(alex, chili, LAST);
    await leftovers(alex, monday, "2026-11-17");
    await db.as(alex, "delete from public.meal_plan_entries where id = $1", [monday]);
    expect(await week(alex, LAST)).toEqual([
      { plan_date: "2026-11-17", meal: "lunch", title: "Chili", servings: 2, leftover: null },
    ]);
  });

  it("can't link to another household's meal by hand", async () => {
    const theirs = await plan(stranger, await recipe(stranger, "Stew"), LAST);
    await expect(
      db.as(
        alex,
        "insert into public.meal_plan_entries (plan_date, meal, recipe_id, servings, leftover_of) values ($1, 'lunch', $2, 2, $3)",
        [LAST, chili, theirs],
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("copy_plan_week", () => {
  const copy = async (user: TestUser, from = LAST, to = NEXT) =>
    (await db.as<{ n: number }>(user, "select public.copy_plan_week($1, $2) as n", [from, to]))
      .rows[0]!.n;

  it("copies the week day for day, with leftovers pointing at the new meals", async () => {
    const monday = await plan(alex, chili, LAST);
    await plan(alex, oats, "2026-11-18", "breakfast");
    await leftovers(alex, monday, "2026-11-17");
    expect(await copy(sam)).toBe(3);
    expect(await week(alex, NEXT)).toEqual([
      { plan_date: NEXT, meal: "dinner", title: "Chili", servings: 4, leftover: null },
      {
        plan_date: "2026-11-24",
        meal: "lunch",
        title: "Chili",
        servings: 2,
        leftover: "Chili 11-23",
      },
      { plan_date: "2026-11-25", meal: "breakfast", title: "Oats", servings: 4, leftover: null },
    ]);
  });

  it("is safe to tap twice: what's already planned is skipped", async () => {
    await plan(alex, chili, LAST);
    expect(await copy(alex)).toBe(1);
    expect(await copy(alex)).toBe(0);
    expect(await week(alex, NEXT)).toHaveLength(1);
  });

  it("needs Mondays and copies nothing for strangers", async () => {
    await plan(alex, chili, LAST);
    await expect(copy(alex, "2026-11-17", NEXT)).rejects.toThrow(/Monday/);
    expect(await copy(stranger)).toBe(0);
    expect(await week(stranger, NEXT)).toEqual([]);
  });
});

describe("weekly budget", () => {
  const budget = async (user: TestUser) =>
    (
      await db.as<{ b: number | null }>(
        user,
        "select weekly_budget::float as b from public.households",
      )
    ).rows;

  it("is shared by the couple and can be cleared", async () => {
    await db.as(alex, "select public.set_weekly_budget(160)");
    expect(await budget(sam)).toEqual([{ b: 160 }]);
    await db.as(sam, "select public.set_weekly_budget(null)");
    expect(await budget(alex)).toEqual([{ b: null }]);
    expect(await budget(stranger)).toEqual([{ b: null }]);
  });

  it("must be a sensible amount, and can't be written directly", async () => {
    await expect(db.as(alex, "select public.set_weekly_budget(0)")).rejects.toThrow(/check/);
    await expect(db.as(alex, "select public.set_weekly_budget(50000)")).rejects.toThrow(
      /check|numeric/,
    );
    await expect(
      db.as(alex, "update public.households set weekly_budget = 5 where true"),
    ).rejects.toThrow(/permission denied/);
  });
});
