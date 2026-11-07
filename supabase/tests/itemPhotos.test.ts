import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// Item photos: household-only, JPEG only, small, and gone with their item.

let db: TestDb;
let alex: TestUser;
let sam: TestUser; // Alex's spouse
let stranger: TestUser;
let itemId: string;

// The smallest thing that passes the JPEG check: FF D8 FF + a byte, as hex.
const JPEG = "ffd8ffe0";

beforeEach(async () => {
  db = await createTestDb();
  alex = await db.createUser("alex@example.com");
  sam = await db.createUser("sam@example.com");
  stranger = await db.createUser("stranger@example.com");
  await db.as(alex, "select public.create_household_invite($1, $2)", [sam.email, fakeTokenHash(1)]);
  await db.as(sam, "select public.accept_household_invite($1)", [fakeTokenHash(1)]);
  itemId = await addItem(alex, "Paper towels");
});

async function addItem(user: TestUser, name: string): Promise<string> {
  const { rows } = await db.as<{ id: string }>(
    user,
    "insert into public.items (name, dimension, compare_unit) values ($1, 'count', 'each') returning id",
    [name],
  );
  return rows[0]!.id;
}

const setPhoto = (user: TestUser, item: string, photo: string) =>
  db.as(
    user,
    `insert into public.item_photos (item_id, photo) values ($1, decode($2, 'hex'))
     on conflict (item_id) do update set photo = excluded.photo`,
    [item, photo],
  );

const photoCount = async (user: TestUser) =>
  (await db.as<{ n: number }>(user, "select count(*)::int as n from public.item_photos")).rows[0]!
    .n;

describe("item photos", () => {
  it("can be added by either partner and seen by both", async () => {
    await setPhoto(sam, itemId, JPEG);
    expect(await photoCount(alex)).toBe(1);
    expect(await photoCount(sam)).toBe(1);
  });

  it("are invisible to another household", async () => {
    await setPhoto(alex, itemId, JPEG);
    expect(await photoCount(stranger)).toBe(0);
  });

  it("can't be attached to another household's item", async () => {
    await expect(setPhoto(stranger, itemId, JPEG)).rejects.toThrow();
  });

  it("gets a new updated_at when replaced", async () => {
    await setPhoto(alex, itemId, JPEG);
    const before = await db.as<{ updated_at: string }>(
      alex,
      "select updated_at::text from public.item_photos",
    );
    await db.admin("select pg_sleep(0.01)");
    await setPhoto(alex, itemId, "ffd8ffe1");
    const after = await db.as<{ updated_at: string }>(
      alex,
      "select updated_at::text from public.item_photos",
    );
    expect(after.rows[0]!.updated_at).not.toBe(before.rows[0]!.updated_at);
  });

  it("go away with their item", async () => {
    await setPhoto(alex, itemId, JPEG);
    await db.as(alex, "delete from public.items where id = $1", [itemId]);
    expect(await photoCount(alex)).toBe(0);
  });

  it("refuse anything that isn't a JPEG", async () => {
    await expect(setPhoto(alex, itemId, "89504e47")).rejects.toThrow(/check/); // PNG
    await expect(setPhoto(alex, itemId, "3c7376673e")).rejects.toThrow(/check/); // <svg>
  });

  it("refuse photos over 100 KB", async () => {
    const big = `ffd8ff${"00".repeat(100_000)}`;
    await expect(setPhoto(alex, itemId, big)).rejects.toThrow(/check/);
  });

  it("can't have their household or date set by the app", async () => {
    await expect(
      db.as(
        alex,
        "insert into public.item_photos (item_id, photo, updated_at) values ($1, decode($2, 'hex'), now())",
        [itemId, JPEG],
      ),
    ).rejects.toThrow(/permission/);
  });
});
