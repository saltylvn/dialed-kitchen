import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type TestUser } from "./testDb";

// The daily AI limit, against real Postgres.

let db: TestDb;
let alex: TestUser;
let sam: TestUser;

beforeEach(async () => {
  db = await createTestDb();
  alex = await db.createUser("alex@example.com");
  sam = await db.createUser("sam@example.com");
});

const take = async (user: TestUser, limit: number) =>
  (await db.as<{ ok: boolean }>(user, "select public.take_ai_request($1) as ok", [limit])).rows[0]!
    .ok;

describe("take_ai_request", () => {
  it("allows requests up to the limit, then refuses", async () => {
    expect(await take(alex, 2)).toBe(true);
    expect(await take(alex, 2)).toBe(true);
    expect(await take(alex, 2)).toBe(false);
  });

  it("counts each person separately", async () => {
    expect(await take(alex, 1)).toBe(true);
    expect(await take(alex, 1)).toBe(false);
    expect(await take(sam, 1)).toBe(true);
  });

  it("frees up requests older than 24 hours", async () => {
    expect(await take(alex, 1)).toBe(true);
    await db.admin("update public.ai_requests set created_at = now() - interval '25 hours'");
    expect(await take(alex, 1)).toBe(true);
  });

  it("can't be used by signed-out visitors, or to forge or erase requests", async () => {
    await expect(db.as(null, "select public.take_ai_request(5)")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.as(alex, "insert into public.ai_requests (user_id) values ($1)", [alex.id]),
    ).rejects.toThrow(/permission denied/);
    await expect(db.as(alex, "delete from public.ai_requests")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("shows people only their own requests", async () => {
    await take(alex, 5);
    expect((await db.as(sam, "select * from public.ai_requests")).rows).toEqual([]);
  });

  it("rejects nonsense limits", async () => {
    await expect(db.as(alex, "select public.take_ai_request(0)")).rejects.toThrow(/Invalid limit/);
  });
});
