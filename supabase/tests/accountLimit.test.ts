import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type TestUser } from "./testDb";

// The 25-account limit, against real Postgres.

let db: TestDb;
let first: TestUser;

beforeEach(async () => {
  db = await createTestDb();
  first = await db.createUser("user1@example.com");
  for (let i = 2; i <= 24; i++) await db.createUser(`user${i}@example.com`);
});

const accepting = async (user: TestUser | null) =>
  (await db.as<{ ok: boolean }>(user, "select public.accepting_new_accounts() as ok")).rows[0]!.ok;

describe("account limit", () => {
  it("allows the 25th account, then refuses the 26th", async () => {
    expect(await accepting(null)).toBe(true);
    await db.createUser("user25@example.com");
    expect(await accepting(null)).toBe(false);
    await expect(db.createUser("user26@example.com")).rejects.toThrow(/Account limit reached/);
  });

  it("still gives every allowed account its own household", async () => {
    await db.createUser("user25@example.com");
    const { rows } = await db.admin<{ n: number }>(
      "select count(distinct household_id)::int as n from public.household_members",
    );
    expect(rows[0]!.n).toBe(25);
  });

  it("frees a place when an account is deleted", async () => {
    await db.createUser("user25@example.com");
    await db.admin("delete from auth.users where id = $1", [first.id]);
    expect(await accepting(null)).toBe(true);
    await db.createUser("user26@example.com");
  });

  it("only answers yes or no, and can't be switched off by users", async () => {
    expect(typeof (await accepting(first))).toBe("boolean");
    await expect(
      db.as(first, "alter table auth.users disable trigger enforce_account_limit"),
    ).rejects.toThrow(/must be owner|permission denied/);
    await expect(db.as(first, "select private.enforce_account_limit()")).rejects.toThrow(
      /permission denied/,
    );
  });
});
