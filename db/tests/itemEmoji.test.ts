import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// A custom emoji per item: household-only, and only ever a short symbol.

let db: TestDb;
let alex: TestUser;
let sam: TestUser; // Alex's spouse
let stranger: TestUser;
let itemId: string;

beforeEach(async () => {
  db = await createTestDb();
  alex = await db.createUser("alex@example.com");
  sam = await db.createUser("sam@example.com");
  stranger = await db.createUser("stranger@example.com");
  await db.as(alex, "select public.create_household_invite($1, $2)", [sam.email, fakeTokenHash(1)]);
  await db.as(sam, "select public.accept_household_invite($1)", [fakeTokenHash(1)]);
  const { rows } = await db.as<{ id: string }>(
    alex,
    "insert into public.items (name, dimension, compare_unit) values ('Paper towels', 'count', 'each') returning id",
  );
  itemId = rows[0]!.id;
});

const setEmoji = (user: TestUser, emoji: string | null) =>
  db.as<{ emoji: string | null }>(
    user,
    "update public.items set emoji = $1 where id = $2 returning emoji",
    [emoji, itemId],
  );

describe("item emoji", () => {
  it("starts empty (the automatic emoji is used)", async () => {
    const { rows } = await db.as<{ emoji: string | null }>(
      alex,
      "select emoji from public.items where id = $1",
      [itemId],
    );
    expect(rows[0]?.emoji).toBeNull();
  });

  it("can be set and cleared by either partner", async () => {
    expect((await setEmoji(sam, "🧻")).rows[0]?.emoji).toBe("🧻");
    expect((await setEmoji(alex, "👩🏽‍🍳")).rows[0]?.emoji).toBe("👩🏽‍🍳"); // skin tone + joiner
    expect((await setEmoji(alex, null)).rows[0]?.emoji).toBeNull();
  });

  it("can't be changed by another household", async () => {
    const { rows } = await setEmoji(stranger, "🧻");
    expect(rows).toHaveLength(0); // RLS: the row isn't even visible
  });

  it.each(["", "hello", "🧻 x", "<b>", "🧻".repeat(17)])("refuses %j", async (value) => {
    await expect(setEmoji(alex, value)).rejects.toThrow(/check/);
  });
});
