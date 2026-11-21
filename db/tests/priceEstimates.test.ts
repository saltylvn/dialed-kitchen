import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// AI price estimates (docs/decisions/0057): shared by the couple, private to the household,
// checked by the database.

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

const save = (user: TestUser, key: string, price = 0.01, dimension = "weight") =>
  db.as(
    user,
    `insert into public.price_estimates (key, dimension, unit_price_base, model)
     values ($1, $2, $3, 'gemini-test')
     on conflict (household_id, key, dimension)
     do update set unit_price_base = excluded.unit_price_base, model = excluded.model`,
    [key, dimension, price],
  );

const keys = async (user: TestUser) =>
  (
    await db.as<{ key: string; p: number }>(
      user,
      "select key, unit_price_base::float as p from public.price_estimates order by key",
    )
  ).rows;

describe("price_estimates", () => {
  it("are shared by the couple and hidden from everyone else", async () => {
    await save(alex, "ground beef");
    expect(await keys(sam)).toEqual([{ key: "ground beef", p: 0.01 }]);
    expect(await keys(stranger)).toEqual([]);
  });

  it("are updated in place, one per ingredient and measure", async () => {
    await save(alex, "rice", 0.004);
    await save(sam, "rice", 0.005);
    expect(await keys(alex)).toEqual([{ key: "rice", p: 0.005 }]);
  });

  it("refuse odd keys, measures and prices", async () => {
    await expect(save(alex, "Rice")).rejects.toThrow(/check/);
    await expect(save(alex, "")).rejects.toThrow(/check/);
    await expect(save(alex, "rice", 0)).rejects.toThrow(/check/);
    await expect(save(alex, "rice", 500)).rejects.toThrow(/check|numeric/);
    await expect(save(alex, "rice", 0.01, "cups")).rejects.toThrow(/check/);
  });

  it("can't be written into another household", async () => {
    const { rows } = await db.admin<{ id: string }>(
      "select household_id as id from public.household_members where user_id = $1",
      [stranger.id],
    );
    await expect(
      db.as(
        alex,
        "insert into public.price_estimates (household_id, key, dimension, unit_price_base, model) values ($1, 'x', 'count', 1, 'm')",
        [rows[0]!.id],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
