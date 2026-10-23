import { beforeEach, describe, expect, it } from "vitest";
import { pricePerBase, UNITS, type Unit } from "../../lib/units";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// Stores, items and price history, tested against real Postgres with the real migrations.

let db: TestDb;
let alex: TestUser;
let sam: TestUser; // Alex's spouse
let stranger: TestUser; // another household entirely

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

const addStore = (user: TestUser, name: string) =>
  one<{ id: string }>(user, "insert into public.stores (name) values ($1) returning id", [name]);

const addItem = (user: TestUser, name: string, dimension: string, compareUnit: string) =>
  one<{ id: string }>(
    user,
    "insert into public.items (name, dimension, compare_unit) values ($1, $2, $3) returning id",
    [name, dimension, compareUnit],
  );

const addPrice = (
  user: TestUser,
  p: {
    item: string;
    store: string;
    price: number;
    qty: number;
    unit: Unit;
    on?: string;
    sale?: boolean;
  },
) =>
  one<{ id: string; unit_price_base: string }>(
    user,
    `insert into public.item_prices
       (item_id, store_id, price, package_quantity, package_unit, on_sale, observed_on)
     values ($1, $2, $3, $4, $5, $6, $7) returning id, unit_price_base`,
    [p.item, p.store, p.price, p.qty, p.unit, p.sale ?? false, p.on ?? "2026-10-20"],
  );

describe("units in SQL match lib/units.ts", () => {
  it("has the same units, dimensions and conversion factors", async () => {
    for (const [unit, def] of Object.entries(UNITS)) {
      const { rows } = await db.admin<{ dimension: string; to_base: string }>(
        "select private.unit_dimension($1) as dimension, private.unit_to_base($1)::text as to_base",
        [unit],
      );
      expect(rows[0]).toEqual({ dimension: def.dimension, to_base: String(def.toBase) });
    }
    const { rows } = await db.admin("select private.unit_dimension('cup') as d");
    expect(rows[0]).toEqual({ d: null });
  });
});

describe("shared between partners, private from everyone else", () => {
  it("lets both partners see and add to the same prices", async () => {
    const aldi = await addStore(alex, "Aldi");
    const chicken = await addItem(sam, "Chicken thighs", "weight", "lb");
    await addPrice(sam, { item: chicken.id, store: aldi.id, price: 5.97, qty: 3, unit: "lb" });

    const forAlex = await db.as(alex, "select count(*)::int as n from public.item_prices");
    expect(forAlex.rows[0]).toEqual({ n: 1 });
  });

  it("hides one household's data from another", async () => {
    const aldi = await addStore(alex, "Aldi");
    const chicken = await addItem(alex, "Chicken thighs", "weight", "lb");
    await addPrice(alex, { item: chicken.id, store: aldi.id, price: 5.97, qty: 3, unit: "lb" });

    for (const table of ["stores", "items", "item_prices", "item_best_prices"]) {
      const { rows } = await db.as(stranger, `select * from public.${table}`);
      expect(rows, table).toEqual([]);
    }
    const update = await db.as(stranger, "update public.items set name = 'Hacked' returning id");
    expect(update.rows).toEqual([]);
    const del = await db.as(stranger, "delete from public.stores returning id");
    expect(del.rows).toEqual([]);
  });

  it("won't let anyone write into another household or forge who entered a price", async () => {
    const theirs = await one<{ household_id: string }>(
      alex,
      "select household_id from public.items union all select id from public.households limit 1",
    );
    await expect(
      db.as(stranger, "insert into public.stores (name, household_id) values ('X', $1)", [
        theirs.household_id,
      ]),
    ).rejects.toThrow(/permission denied/);
    const aldi = await addStore(alex, "Aldi");
    const chicken = await addItem(alex, "Chicken", "weight", "lb");
    await expect(
      db.as(
        alex,
        `insert into public.item_prices (item_id, store_id, price, package_quantity, package_unit, observed_on, created_by)
         values ($1, $2, 1, 1, 'lb', '2026-10-20', $3)`,
        [chicken.id, aldi.id, sam.id],
      ),
    ).rejects.toThrow(/permission denied/);
    // The computed unit price can't be overwritten (Postgres refuses before checking rights).
    await expect(db.as(alex, "update public.item_prices set unit_price_base = 0")).rejects.toThrow(
      /permission denied|can only be updated to DEFAULT/,
    );
  });

  it("won't let a price point at another household's item or store", async () => {
    const theirStore = await addStore(alex, "Aldi");
    const myItem = await addItem(stranger, "Eggs", "count", "each");
    await expect(
      addPrice(stranger, {
        item: myItem.id,
        store: theirStore.id,
        price: 3,
        qty: 12,
        unit: "each",
      }),
    ).rejects.toThrow(/foreign key/);
  });

  it("gives signed-out visitors nothing", async () => {
    await expect(db.as(null, "select * from public.items")).rejects.toThrow(/permission denied/);
    await expect(db.as(null, "select * from public.item_best_prices")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("keeps the data with the household creator when a partnership ends", async () => {
    await addItem(sam, "Olive oil", "volume", "fl_oz");
    await db.as(sam, "select public.end_partnership()");
    expect((await db.as(alex, "select name from public.items")).rows).toEqual([
      { name: "Olive oil" },
    ]);
    expect((await db.as(sam, "select name from public.items")).rows).toEqual([]);
  });
});

describe("unit prices and the best price", () => {
  it("computes each price's unit price in the database, matching lib/units", async () => {
    const aldi = await addStore(alex, "Aldi");
    const rice = await addItem(alex, "Rice", "weight", "lb");
    const row = await addPrice(alex, {
      item: rice.id,
      store: aldi.id,
      price: 6.49,
      qty: 5,
      unit: "lb",
    });
    expect(Number(row.unit_price_base)).toBeCloseTo(pricePerBase(6.49, 5, "lb"), 12);
  });

  it("finds the best price by unit price, across package sizes and units", async () => {
    const aldi = await addStore(alex, "Aldi");
    const kroger = await addStore(alex, "Kroger");
    const rice = await addItem(alex, "Rice", "weight", "lb");
    await addPrice(alex, { item: rice.id, store: kroger.id, price: 3.99, qty: 2, unit: "lb" }); // $2.00/lb
    const best = await addPrice(alex, {
      item: rice.id,
      store: aldi.id,
      price: 6.49,
      qty: 5,
      unit: "lb",
    }); // $1.30/lb
    await addPrice(alex, { item: rice.id, store: kroger.id, price: 1.5, qty: 16, unit: "oz" }); // $1.50/lb

    const { rows } = await db.as<{ price_id: string; store_id: string }>(
      sam,
      "select price_id, store_id from public.item_best_prices where item_id = $1",
      [rice.id],
    );
    expect(rows).toEqual([{ price_id: best.id, store_id: aldi.id }]);
  });

  it("prefers the most recent of two equal best prices", async () => {
    const aldi = await addStore(alex, "Aldi");
    const eggs = await addItem(alex, "Eggs", "count", "each");
    await addPrice(alex, {
      item: eggs.id,
      store: aldi.id,
      price: 3,
      qty: 1,
      unit: "dozen",
      on: "2026-09-01",
    });
    const recent = await addPrice(alex, {
      item: eggs.id,
      store: aldi.id,
      price: 3,
      qty: 12,
      unit: "each",
      on: "2026-10-01",
    });
    const { rows } = await db.as<{ price_id: string }>(
      alex,
      "select price_id from public.item_best_prices",
    );
    expect(rows).toEqual([{ price_id: recent.id }]);
  });
});

describe("keeping the data sensible", () => {
  it("rejects a package unit that doesn't fit the item (no pounds of milk)", async () => {
    const aldi = await addStore(alex, "Aldi");
    const milk = await addItem(alex, "Milk", "volume", "gal");
    await expect(
      addPrice(alex, { item: milk.id, store: aldi.id, price: 3, qty: 1, unit: "lb" }),
    ).rejects.toThrow(/doesn't fit this item/);
  });

  it("rejects an item whose display unit doesn't match its kind", async () => {
    await expect(addItem(alex, "Milk", "volume", "lb")).rejects.toThrow(/check constraint/);
  });

  it("won't switch an item between weight and volume once it has prices", async () => {
    const aldi = await addStore(alex, "Aldi");
    const flour = await addItem(alex, "Flour", "weight", "lb");
    await addPrice(alex, { item: flour.id, store: aldi.id, price: 4, qty: 5, unit: "lb" });
    await expect(
      db.as(
        alex,
        "update public.items set dimension = 'volume', compare_unit = 'fl_oz' where id = $1",
        [flour.id],
      ),
    ).rejects.toThrow(/already has prices/);
  });

  it("rejects zero, negative and absurd prices and quantities", async () => {
    const aldi = await addStore(alex, "Aldi");
    const flour = await addItem(alex, "Flour", "weight", "lb");
    for (const [price, qty] of [
      [0, 1],
      [-1, 1],
      [100000, 1],
      [1, 0],
    ]) {
      await expect(
        addPrice(alex, { item: flour.id, store: aldi.id, price: price!, qty: qty!, unit: "lb" }),
      ).rejects.toThrow(/check constraint/);
    }
  });

  it("treats store and item names as the same regardless of capitals", async () => {
    await addStore(alex, "Aldi");
    await expect(addStore(sam, "ALDI")).rejects.toThrow(/stores_unique_name/);
    await addItem(alex, "Eggs", "count", "each");
    await expect(addItem(alex, "eggs", "count", "each")).rejects.toThrow(/items_unique_name/);
  });

  it("rejects blank or padded names", async () => {
    await expect(addStore(alex, "  ")).rejects.toThrow(/check constraint/);
    await expect(addStore(alex, " Aldi")).rejects.toThrow(/check constraint/);
  });

  it("protects a store's price history from accidental deletion", async () => {
    const aldi = await addStore(alex, "Aldi");
    const flour = await addItem(alex, "Flour", "weight", "lb");
    await addPrice(alex, { item: flour.id, store: aldi.id, price: 4, qty: 5, unit: "lb" });
    await expect(db.as(alex, "delete from public.stores where id = $1", [aldi.id])).rejects.toThrow(
      /foreign key/,
    );
  });

  it("removes an item's prices along with the item", async () => {
    const aldi = await addStore(alex, "Aldi");
    const flour = await addItem(alex, "Flour", "weight", "lb");
    await addPrice(alex, { item: flour.id, store: aldi.id, price: 4, qty: 5, unit: "lb" });
    await db.as(alex, "delete from public.items where id = $1", [flour.id]);
    expect((await db.as(alex, "select * from public.item_prices")).rows).toEqual([]);
  });
});
