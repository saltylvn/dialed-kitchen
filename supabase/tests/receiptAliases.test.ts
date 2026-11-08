import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// Remembered receipt matches: household-only, one per store and receipt text, in the
// canonical capitals form, and forgotten with their item or store.

let db: TestDb;
let alex: TestUser;
let sam: TestUser; // Alex's spouse
let stranger: TestUser;
let eggs: string;
let milk: string;
let costco: string;

beforeEach(async () => {
  db = await createTestDb();
  alex = await db.createUser("alex@example.com");
  sam = await db.createUser("sam@example.com");
  stranger = await db.createUser("stranger@example.com");
  await db.as(alex, "select public.create_household_invite($1, $2)", [sam.email, fakeTokenHash(1)]);
  await db.as(sam, "select public.accept_household_invite($1)", [fakeTokenHash(1)]);
  eggs = await addItem(alex, "Organic eggs");
  milk = await addItem(alex, "Whole milk");
  costco = (await db.as<{ id: string }>(alex, "select id from public.stores where name = 'Costco'"))
    .rows[0]!.id;
});

async function addItem(user: TestUser, name: string): Promise<string> {
  const { rows } = await db.as<{ id: string }>(
    user,
    "insert into public.items (name, dimension, compare_unit) values ($1, 'count', 'each') returning id",
    [name],
  );
  return rows[0]!.id;
}

// Exactly what the app's upsert sends (PostgREST): on conflict, every column it was given.
const remember = (user: TestUser, store: string, text: string, item: string) =>
  db.as(
    user,
    `insert into public.receipt_aliases (store_id, receipt_text, item_id) values ($1, $2, $3)
     on conflict (household_id, store_id, receipt_text) do update
       set store_id = excluded.store_id, receipt_text = excluded.receipt_text, item_id = excluded.item_id`,
    [store, text, item],
  );

const matches = async (user: TestUser) =>
  (
    await db.as<{ receipt_text: string; item_id: string }>(
      user,
      "select receipt_text, item_id from public.receipt_aliases order by receipt_text",
    )
  ).rows;

describe("receipt aliases", () => {
  it("are shared by both partners", async () => {
    await remember(sam, costco, "KS ORG EGGS 24CT", eggs);
    expect(await matches(alex)).toEqual([{ receipt_text: "KS ORG EGGS 24CT", item_id: eggs }]);
  });

  it("are replaced, not duplicated, when a line is matched again", async () => {
    await remember(alex, costco, "KS ORG EGGS 24CT", eggs);
    await remember(alex, costco, "KS ORG EGGS 24CT", milk);
    expect(await matches(alex)).toEqual([{ receipt_text: "KS ORG EGGS 24CT", item_id: milk }]);
  });

  it("are invisible to another household, which can't point at your items", async () => {
    await remember(alex, costco, "KS ORG EGGS 24CT", eggs);
    expect(await matches(stranger)).toEqual([]);
    const theirCostco = (
      await db.as<{ id: string }>(stranger, "select id from public.stores where name = 'Costco'")
    ).rows[0]!.id;
    await expect(remember(stranger, theirCostco, "EGGS", eggs)).rejects.toThrow();
  });

  it("only store the canonical form: capitals, single spaces, trimmed", async () => {
    await expect(remember(alex, costco, "ks org eggs", eggs)).rejects.toThrow(/check/);
    await expect(remember(alex, costco, "KS  ORG", eggs)).rejects.toThrow(/check/);
    await expect(remember(alex, costco, " KS", eggs)).rejects.toThrow(/check/);
    await expect(remember(alex, costco, "", eggs)).rejects.toThrow(/check/);
  });

  it("are forgotten with their item", async () => {
    await remember(alex, costco, "KS ORG EGGS 24CT", eggs);
    await db.as(alex, "delete from public.items where id = $1", [eggs]);
    expect(await matches(alex)).toEqual([]);
  });

  it("can't have their household or date set by the app", async () => {
    await expect(
      db.as(
        alex,
        "insert into public.receipt_aliases (store_id, receipt_text, item_id, updated_at) values ($1, 'X', $2, now())",
        [costco, eggs],
      ),
    ).rejects.toThrow(/permission/);
  });
});
