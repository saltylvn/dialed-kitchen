import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// The shared grocery list and "last price at this store", against real Postgres.

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

async function one<T>(user: TestUser, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.as<T>(user, sql, params);
  return rows[0]!;
}

const addItem = (user: TestUser, name: string, unit = "lb", dimension = "weight") =>
  one<{ id: string }>(
    user,
    "insert into public.items (name, dimension, compare_unit) values ($1, $2, $3) returning id",
    [name, dimension, unit],
  );

const addToList = (
  user: TestUser,
  name: string,
  itemId: string | null = null,
  qty: number | null = null,
  unit: string | null = null,
) =>
  one<{ id: string }>(
    user,
    "insert into public.grocery_list_items (name, item_id, quantity, unit) values ($1, $2, $3, $4) returning id",
    [name, itemId, qty, unit],
  );

describe("the shared list", () => {
  it("is shared by both partners and hidden from everyone else", async () => {
    await addToList(alex, "Bananas");
    await addToList(sam, "Milk");
    const forSam = await db.as<{ name: string }>(
      sam,
      "select name from public.grocery_list_items order by name",
    );
    expect(forSam.rows.map((r) => r.name)).toEqual(["Bananas", "Milk"]);
    expect((await db.as(stranger, "select * from public.grocery_list_items")).rows).toEqual([]);
    expect(
      (await db.as(stranger, "update public.grocery_list_items set checked = true returning id"))
        .rows,
    ).toEqual([]);
  });

  it("stamps the time when something is checked off, and clears it when unchecked", async () => {
    const row = await addToList(alex, "Bananas");
    await db.as(sam, "update public.grocery_list_items set checked = true where id = $1", [row.id]);
    const checked = await one<{ checked_at: Date | null }>(
      alex,
      "select checked_at from public.grocery_list_items",
    );
    expect(checked.checked_at).toBeInstanceOf(Date);
    await db.as(alex, "update public.grocery_list_items set checked = false where id = $1", [
      row.id,
    ]);
    expect(await one(alex, "select checked_at from public.grocery_list_items")).toEqual({
      checked_at: null,
    });
  });

  it("won't let the app set the household, author or check time itself", async () => {
    const { household_id } = await one<{ household_id: string }>(
      stranger,
      "select household_id from public.household_members",
    );
    await expect(
      db.as(alex, "insert into public.grocery_list_items (name, household_id) values ('X', $1)", [
        household_id,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(alex, "update public.grocery_list_items set checked_at = now()"),
    ).rejects.toThrow(/permission denied/);
  });

  it("keeps a price-book item on the list only once while it's still to buy", async () => {
    const rice = await addItem(alex, "Rice");
    const first = await addToList(alex, "Rice", rice.id);
    await expect(addToList(sam, "Rice", rice.id)).rejects.toThrow(/one_open_per_item/);
    // Once checked off, it can go on the list again next time.
    await db.as(alex, "update public.grocery_list_items set checked = true where id = $1", [
      first.id,
    ]);
    await expect(addToList(sam, "Rice", rice.id)).resolves.toBeDefined();
  });

  it("keeps an entry as plain text if its price-book item is deleted", async () => {
    const rice = await addItem(alex, "Rice");
    await addToList(alex, "Rice", rice.id, 2, "lb");
    await db.as(alex, "delete from public.items where id = $1", [rice.id]);
    expect(
      await one(
        sam,
        "select name, item_id, quantity::float as quantity, unit from public.grocery_list_items",
      ),
    ).toEqual({
      name: "Rice",
      item_id: null,
      quantity: 2,
      unit: "lb",
    });
  });

  it("won't link to another household's item", async () => {
    const theirs = await addItem(stranger, "Caviar", "oz");
    await expect(addToList(alex, "Caviar", theirs.id)).rejects.toThrow(/foreign key/);
  });

  it("rejects nonsense amounts and names", async () => {
    await expect(addToList(alex, "Milk", null, null, "gal")).rejects.toThrow(/check constraint/);
    await expect(addToList(alex, "Milk", null, 0)).rejects.toThrow(/check constraint/);
    await expect(addToList(alex, "Milk", null, 1, "cups")).rejects.toThrow(/check constraint/);
    await expect(addToList(alex, "  ")).rejects.toThrow(/check constraint/);
  });
});

describe("last price at each store", () => {
  it("returns the most recent price per item and store", async () => {
    const rice = await addItem(alex, "Rice");
    const aldi = await one<{ id: string }>(
      alex,
      "select id from public.stores where name = 'WinCo'",
    );
    const kroger = await one<{ id: string }>(
      alex,
      "select id from public.stores where name = 'Costco'",
    );
    const add = (store: string, price: number, on: string) =>
      db.as(
        alex,
        `insert into public.item_prices (item_id, store_id, price, package_quantity, package_unit, observed_on)
         values ($1, $2, $3, 1, 'lb', $4)`,
        [rice.id, store, price, on],
      );
    await add(aldi.id, 1.0, "2026-09-01");
    await add(aldi.id, 1.4, "2026-10-01"); // newer, though pricier
    await add(kroger.id, 2.0, "2026-10-05");

    const { rows } = await db.as<{ store_id: string; price: string }>(
      sam,
      "select store_id, price::text from public.item_latest_store_prices where item_id = $1 order by price",
      [rice.id],
    );
    expect(rows).toEqual([
      { store_id: aldi.id, price: "1.40" },
      { store_id: kroger.id, price: "2.00" },
    ]);
    expect((await db.as(stranger, "select * from public.item_latest_store_prices")).rows).toEqual(
      [],
    );
  });
});
