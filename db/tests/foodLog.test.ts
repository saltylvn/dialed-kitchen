import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// Calorie counting (docs/decisions/0051): goals and the food log, against real Postgres.

let db: TestDb;
let alex: TestUser;
let sam: TestUser; // Alex's spouse
let stranger: TestUser;
let shake: string; // 400 kcal, 30 g protein per serving
let tacos: string; // no numbers

const DAY = "2026-11-23";

beforeEach(async () => {
  db = await createTestDb();
  alex = await db.createUser("alex@example.com");
  sam = await db.createUser("sam@example.com");
  stranger = await db.createUser("stranger@example.com");
  await db.as(alex, "select public.create_household_invite($1, $2)", [sam.email, fakeTokenHash(1)]);
  await db.as(sam, "select public.accept_household_invite($1)", [fakeTokenHash(1)]);
  shake = await recipe(alex, "Protein shake", { calories: 400, protein_g: 30 });
  tacos = await recipe(alex, "Tacos", {});
});

async function recipe(user: TestUser, title: string, nutrition: object) {
  const { rows } = await db.as<{ id: string }>(
    user,
    "select public.save_recipe(null, $1, 2::smallint, 'own', null, null, '{}', '[]', $2) as id",
    [title, JSON.stringify(nutrition)],
  );
  return rows[0]!.id;
}

async function plan(user: TestUser, recipeId: string, meal = "breakfast", date = DAY) {
  const { rows } = await db.as<{ id: string }>(
    user,
    "insert into public.meal_plan_entries (plan_date, meal, recipe_id, servings) values ($1, $2, $3, 2) returning id",
    [date, meal, recipeId],
  );
  return rows[0]!.id;
}

const ateIt = (user: TestUser, entryId: string, portion: number | null = null) =>
  db.as(user, "select public.log_planned_meal($1, $2)", [entryId, portion]);

type LogRow = { label: string; portion: number; calories: number | null; protein: number | null };
const myLog = async (user: TestUser) =>
  (
    await db.as<LogRow>(
      user,
      "select label, portion::float as portion, calories, protein_g::float as protein from public.food_log order by created_at",
    )
  ).rows;

describe("log_planned_meal", () => {
  it("copies the recipe's numbers, scaled to the portion", async () => {
    const entry = await plan(alex, shake);
    await ateIt(alex, entry, 1.5);
    expect(await myLog(alex)).toEqual([
      { label: "Protein shake", portion: 1.5, calories: 600, protein: 45 },
    ]);
  });

  it("keeps unknown numbers unknown, never zero", async () => {
    await ateIt(alex, await plan(alex, tacos, "dinner"));
    expect(await myLog(alex)).toEqual([
      { label: "Tacos", portion: 1, calories: null, protein: null },
    ]);
  });

  it("logs a meal once per person: tapping again just changes the portion", async () => {
    const entry = await plan(alex, shake);
    await ateIt(alex, entry);
    await ateIt(alex, entry, 2);
    expect(await myLog(alex)).toEqual([
      { label: "Protein shake", portion: 2, calories: 800, protein: 60 },
    ]);
  });

  it("remembers each person's usual portion", async () => {
    await ateIt(alex, await plan(alex, shake, "breakfast", "2026-11-22"), 2);
    await ateIt(alex, await plan(alex, shake));
    await ateIt(sam, await plan(sam, shake, "lunch"));
    const portions = async (user: TestUser) => (await myLog(user)).map((r) => r.portion);
    expect(await portions(alex)).toEqual([2, 2]);
    expect(await portions(sam)).toEqual([1]);
  });

  it("is a snapshot: editing the recipe later doesn't rewrite the log", async () => {
    await ateIt(alex, await plan(alex, shake));
    await db.as(alex, "update public.recipes set calories = 999 where id = $1", [shake]);
    expect((await myLog(alex))[0]!.calories).toBe(400);
  });

  it("refuses someone else's planned meal and silly portions", async () => {
    const entry = await plan(alex, shake);
    await expect(ateIt(stranger, entry)).rejects.toThrow(/Meal not found/);
    await expect(ateIt(alex, entry, 0)).rejects.toThrow(/Portion/);
    await expect(ateIt(alex, entry, 11)).rejects.toThrow(/Portion|numeric/);
  });

  it("refuses signed-out callers", async () => {
    const entry = await plan(alex, shake);
    await expect(db.as(null, "select public.log_planned_meal($1)", [entry])).rejects.toThrow(
      /permission denied|Not signed in/,
    );
  });
});

describe("the food log is private", () => {
  it("each partner sees only their own log, even in a shared household", async () => {
    const entry = await plan(alex, shake);
    await ateIt(alex, entry);
    await ateIt(sam, entry, 0.5);
    expect(await myLog(alex)).toHaveLength(1);
    expect((await myLog(sam))[0]!.portion).toBe(0.5);
    expect(await myLog(stranger)).toEqual([]);
  });

  it("only the owner can delete an entry, and nobody can write directly", async () => {
    await ateIt(alex, await plan(alex, shake));
    await db.as(sam, "delete from public.food_log where true");
    expect(await myLog(alex)).toHaveLength(1);
    await expect(
      db.as(
        alex,
        "insert into public.food_log (household_id, user_id, log_date, meal, label) values (gen_random_uuid(), $1, $2, 'lunch', 'x')",
        [alex.id, DAY],
      ),
    ).rejects.toThrow(/permission denied/);
    await db.as(alex, "delete from public.food_log where true");
    expect(await myLog(alex)).toEqual([]);
  });

  it("keeps the history when the planned meal or recipe is deleted", async () => {
    const entry = await plan(alex, shake);
    await ateIt(alex, entry);
    await db.as(alex, "delete from public.recipes where id = $1", [shake]);
    expect(await myLog(alex)).toEqual([
      { label: "Protein shake", portion: 1, calories: 400, protein: 30 },
    ]);
  });
});

describe("log_day_as_planned", () => {
  it("logs every unlogged meal of the day at the usual portion, and only once", async () => {
    await plan(alex, shake);
    await plan(alex, tacos, "dinner");
    await plan(alex, shake, "lunch", "2026-11-24"); // another day: untouched
    const first = await db.as<{ n: number }>(alex, "select public.log_day_as_planned($1) as n", [
      DAY,
    ]);
    expect(first.rows[0]!.n).toBe(2);
    const again = await db.as<{ n: number }>(alex, "select public.log_day_as_planned($1) as n", [
      DAY,
    ]);
    expect(again.rows[0]!.n).toBe(0);
    expect((await myLog(alex)).map((r) => r.label)).toEqual(["Protein shake", "Tacos"]);
  });
});

describe("log_quick", () => {
  const quick = (user: TestUser, label: string, calories: number | null, protein?: number) =>
    db.as(user, "select public.log_quick($1, 'snacks', $2, $3, $4)", [
      DAY,
      label,
      calories,
      protein ?? null,
    ]);

  it("logs something that isn't a recipe", async () => {
    await quick(alex, "  Protein bar ", 200, 20);
    expect(await myLog(alex)).toEqual([
      { label: "Protein bar", portion: 1, calories: 200, protein: 20 },
    ]);
  });

  it("needs a name and calories in range", async () => {
    await expect(quick(alex, " ", 200)).rejects.toThrow(/check/);
    await expect(quick(alex, "Bar", null)).rejects.toThrow(/Enter the calories/);
    await expect(quick(alex, "Bar", -5)).rejects.toThrow(/check/);
  });

  it("stops a runaway button at 60 a day", async () => {
    for (let i = 0; i < 60; i++) await quick(alex, `Bite ${i}`, 10);
    await expect(quick(alex, "One more", 10)).rejects.toThrow(/Too many entries/);
  });
});

describe("goals", () => {
  const goal = async (user: TestUser) =>
    (await db.as(user, "select calories, protein_g from public.nutrition_goals")).rows;

  it("sets and replaces your own goal, which only you can see", async () => {
    await db.as(alex, "select public.set_my_goal(2100, 150)");
    await db.as(alex, "select public.set_my_goal(2000, null)");
    expect(await goal(alex)).toEqual([{ calories: 2000, protein_g: null }]);
    expect(await goal(sam)).toEqual([]);
  });

  it("refuses unrealistic goals and direct writes", async () => {
    await expect(db.as(alex, "select public.set_my_goal(100, 150)")).rejects.toThrow(/check/);
    await expect(
      db.as(alex, "insert into public.nutrition_goals (user_id, calories) values ($1, 2000)", [
        alex.id,
      ]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("the demo reset", () => {
  it("clears the demo account's food log and goal", async () => {
    const demo = await db.createUser("demo@dialed-kitchen.vercel.app", "credential");
    await db.as(demo, "select public.refresh_demo_if_stale()");
    await db.as(demo, "select public.set_my_goal(2000, 120)");
    await db.as(demo, "select public.log_quick($1, 'lunch', 'Sandwich', 500)", [DAY]);
    await db.admin("update private.demo_state set last_reset_at = now() - interval '25 hours'");
    await db.as(demo, "select public.refresh_demo_if_stale()");
    expect(await myLog(demo)).toEqual([]);
    expect((await db.as(demo, "select 1 from public.nutrition_goals")).rows).toEqual([]);
  });
});
