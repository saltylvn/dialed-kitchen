import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// The shared demo account, against real Postgres.

const DEMO_EMAIL = "demo@dialed-kitchen.vercel.app";
let db: TestDb;
let demo: TestUser;
let alex: TestUser;

beforeEach(async () => {
  db = await createTestDb();
  demo = await db.createUser(DEMO_EMAIL, "email");
  alex = await db.createUser("alex@example.com");
});

const one = async <T>(user: TestUser | null, sql: string, params: unknown[] = []) =>
  (await db.as<T>(user, sql, params)).rows[0]!;
const count = async (user: TestUser, table: string) =>
  (await one<{ n: number }>(user, `select count(*)::int as n from public.${table}`)).n;
const refresh = async (user: TestUser) =>
  (await one<{ ok: boolean }>(user, "select public.refresh_demo_if_stale() as ok")).ok;

describe("who can create accounts", () => {
  it("refuses password (or any non-Google) accounts, except the demo", async () => {
    await expect(db.createUser("sneaky@example.com", "email")).rejects.toThrow(
      /Only Google sign-in can create accounts/,
    );
    await expect(db.createUser("other@example.com", "github")).rejects.toThrow(/Only Google/);
    await db.createUser("new-google@example.com"); // Google still works
  });
});

describe("demo sample data", () => {
  it("fills the demo household on the first sign-in of the day, once", async () => {
    expect(await count(demo, "recipes")).toBe(0);
    expect(await refresh(demo)).toBe(true);
    expect(await count(demo, "recipes")).toBe(6);
    expect(await count(demo, "items")).toBe(9);
    expect(await count(demo, "item_prices")).toBe(23);
    expect(await count(demo, "meal_plan_entries")).toBe(9);
    expect(await count(demo, "pantry_items")).toBe(4);
    expect(await count(demo, "grocery_list_items")).toBe(2);
    expect(await refresh(demo)).toBe(false); // already fresh today
  });

  it("links ingredients to the price book, so the week has a cost", async () => {
    await refresh(demo);
    const { linked } = await one<{ linked: number }>(
      demo,
      "select count(*)::int as linked from public.recipe_ingredients where item_id is not null",
    );
    expect(linked).toBeGreaterThan(10);
    const monday = await one<{ d: string }>(
      demo,
      "select date_trunc('week', current_date)::date::text as d",
    );
    const { priced } = await one<{ priced: number }>(
      demo,
      "select count(*)::int as priced from public.week_shopping($1) where est_cost is not null",
      [monday.d],
    );
    expect(priced).toBeGreaterThan(3);
  });

  it("puts everything back after a day, whatever visitors changed", async () => {
    await refresh(demo);
    await db.as(demo, "delete from public.recipes");
    await db.as(demo, "insert into public.pantry_items (name) values ('Visitor graffiti')");
    await db.admin("update private.demo_state set last_reset_at = now() - interval '25 hours'");
    expect(await refresh(demo)).toBe(true);
    expect(await count(demo, "recipes")).toBe(6);
    expect(await count(demo, "pantry_items")).toBe(4);
  });

  it("never touches anyone else, and does nothing when they call it", async () => {
    await db.as(alex, "insert into public.pantry_items (name) values ('Flour')");
    expect(await refresh(alex)).toBe(false);
    await refresh(demo);
    expect(await count(alex, "pantry_items")).toBe(1);
    expect(await count(alex, "recipes")).toBe(0);
    await expect(db.as(alex, "select private.reset_demo_household()")).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("demo guard rails", () => {
  it("can't send partner invites", async () => {
    await expect(
      db.as(demo, "select public.create_household_invite($1, $2)", [
        "x@example.com",
        fakeTokenHash(1),
      ]),
    ).rejects.toThrow(/The demo can't send invites/);
    await db.as(alex, "select public.create_household_invite($1, $2)", [
      "y@example.com",
      fakeTokenHash(2),
    ]);
  });

  it("gets a small shared AI allowance; real users keep theirs", async () => {
    const take = async (user: TestUser) =>
      (await one<{ ok: boolean }>(user, "select public.take_ai_request(40) as ok")).ok;
    for (let i = 0; i < 10; i++) expect(await take(demo)).toBe(true);
    expect(await take(demo)).toBe(false);
    for (let i = 0; i < 11; i++) expect(await take(alex)).toBe(true);
  });
});
