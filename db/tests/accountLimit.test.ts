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
    await db.admin('delete from neon_auth."user" where id = $1', [first.id]);
    expect(await accepting(null)).toBe(true);
    await db.createUser("user26@example.com");
  });

  it("only answers yes or no, and users can't run or replace the gate", async () => {
    expect(typeof (await accepting(first))).toBe("boolean");
    await expect(
      db.as(first, "select private.check_signup('x@example.com', 'google')"),
    ).rejects.toThrow(/permission denied/);
    await expect(db.as(first, "select private.finish_signup($1)", [first.id])).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.as(
        first,
        "create or replace function private.check_signup(email text, provider text) returns void language sql as ''",
      ),
    ).rejects.toThrow(/must be owner|permission denied/);
  });

  it("lets the sign-up gate's login run the two sign-up functions and nothing else", async () => {
    const asGate = (sql: string, params: unknown[] = []) =>
      db.pg.transaction(async (tx) => {
        await tx.exec("set local role signup_gate");
        return tx.query(sql, params);
      });
    await asGate("select private.check_signup('demo@dialed-kitchen.vercel.app', 'credential')");
    await asGate("select private.finish_signup($1)", [first.id]);
    await expect(asGate("select * from public.households")).rejects.toThrow(/permission denied/);
    await expect(asGate('select * from neon_auth."user"')).rejects.toThrow(/permission denied/);
    await expect(asGate("select private.is_admin()")).rejects.toThrow(/permission denied/);
  });

  it("finishing a sign-up twice changes nothing", async () => {
    await db.admin("select private.finish_signup($1)", [first.id]);
    const { rows } = await db.admin<{ n: number }>(
      "select count(*)::int as n from public.household_members where user_id = $1",
      [first.id],
    );
    expect(rows[0]!.n).toBe(1);
  });
});
