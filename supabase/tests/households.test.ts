import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// Partner sharing, tested against real Postgres with the real migration (docs/decisions/0009).

type Household = {
  household_id: string;
  is_creator: boolean;
  members: { user_id: string; email: string; is_me: boolean }[];
  open_invite: { id: string; invited_email: string; expired: boolean } | null;
};

let db: TestDb;
let alex: TestUser;
let sam: TestUser;
let stranger: TestUser;

beforeEach(async () => {
  db = await createTestDb();
  alex = await db.createUser("alex@example.com");
  sam = await db.createUser("sam@example.com");
  stranger = await db.createUser("stranger@example.com");
});

async function household(user: TestUser): Promise<Household> {
  const { rows } = await db.as<{ h: Household }>(user, "select public.get_my_household() as h");
  return rows[0]!.h;
}

function invite(user: TestUser, email: string, seed = 1) {
  return db.as(user, "select public.create_household_invite($1, $2)", [email, fakeTokenHash(seed)]);
}

function accept(user: TestUser, seed = 1) {
  return db.as(user, "select public.accept_household_invite($1)", [fakeTokenHash(seed)]);
}

async function partner(a: TestUser, b: TestUser) {
  await invite(a, b.email);
  await accept(b);
}

describe("every user has exactly one household", () => {
  it("creates a household of one at sign-up", async () => {
    const h = await household(alex);
    expect(h.is_creator).toBe(true);
    expect(h.members).toEqual([expect.objectContaining({ user_id: alex.id, is_me: true })]);
  });

  it("refuses a second membership for the same person, even for an admin", async () => {
    const { household_id } = await household(sam);
    await expect(
      db.admin("insert into public.household_members (household_id, user_id) values ($1, $2)", [
        household_id,
        alex.id,
      ]),
    ).rejects.toThrow(/one_household_per_person/);
  });
});

describe("privacy (row-level security)", () => {
  it("shows people only their own household", async () => {
    const { rows } = await db.as(alex, "select id from public.households");
    expect(rows).toEqual([{ id: (await household(alex)).household_id }]);
    const members = await db.as<{ user_id: string }>(
      alex,
      "select user_id from public.household_members",
    );
    expect(members.rows.map((r) => r.user_id)).toEqual([alex.id]);
  });

  it("shows signed-out visitors nothing", async () => {
    await expect(db.as(null, "select * from public.households")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.as(null, "select public.get_my_household()")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("never lets the app write to the tables directly", async () => {
    const { household_id } = await household(sam);
    await expect(
      db.as(alex, "insert into public.household_members (household_id, user_id) values ($1, $2)", [
        household_id,
        alex.id,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(db.as(alex, "delete from public.household_members")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.as(alex, "select * from public.household_invites")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("keeps the internal helpers private", async () => {
    await expect(db.as(alex, `select private.create_solo_household('${alex.id}')`)).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("inviting your spouse", () => {
  it("joins the two of you into one shared household", async () => {
    await partner(alex, sam);

    const forAlex = await household(alex);
    const forSam = await household(sam);
    expect(forSam.household_id).toBe(forAlex.household_id);
    expect(forAlex.members.map((m) => m.email)).toEqual([alex.email, sam.email]);
    expect(forAlex.is_creator).toBe(true);
    expect(forSam.is_creator).toBe(false);
    expect(forAlex.open_invite).toBeNull();
  });

  it("only works for the invited email", async () => {
    await invite(alex, sam.email);
    await expect(accept(stranger)).rejects.toThrow(/different account/);
    const { rows } = await db.as<{ h: { status: string } }>(
      stranger,
      "select public.get_household_invite($1) as h",
      [fakeTokenHash(1)],
    );
    expect(rows[0]!.h).toEqual({ status: "wrong_account" }); // no inviter details leaked
  });

  it("matches the email regardless of capitals or spaces", async () => {
    await invite(alex, "  Sam@Example.com ");
    await accept(sam);
    expect((await household(sam)).household_id).toBe((await household(alex)).household_id);
  });

  it("can be used only once", async () => {
    await partner(alex, sam);
    await expect(accept(sam)).rejects.toThrow(/no longer valid/);
  });

  it("expires after 7 days", async () => {
    await invite(alex, sam.email);
    await db.admin(
      "update public.household_invites set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'",
    );
    await expect(accept(sam)).rejects.toThrow(/no longer valid/);
  });

  it("can be cancelled", async () => {
    await invite(alex, sam.email);
    const inviteId = (await household(alex)).open_invite!.id;
    await db.as(alex, "select public.revoke_household_invite($1)", [inviteId]);
    await expect(accept(sam)).rejects.toThrow(/no longer valid/);
  });

  it("can't be cancelled by someone outside the household", async () => {
    await invite(alex, sam.email);
    const inviteId = (await household(alex)).open_invite!.id;
    await expect(
      db.as(stranger, "select public.revoke_household_invite($1)", [inviteId]),
    ).rejects.toThrow(/not found/);
  });

  it("keeps only one open invite: a new one cancels the old", async () => {
    await invite(alex, "old@example.com", 1);
    await invite(alex, sam.email, 2);
    expect((await household(alex)).open_invite?.invited_email).toBe(sam.email);
    const { rows } = await db.admin(
      "select count(*)::int as n from public.household_invites where revoked_at is null",
    );
    expect(rows[0]).toEqual({ n: 1 });
  });

  it("refuses inviting yourself, bad emails and bad token hashes", async () => {
    await expect(invite(alex, alex.email)).rejects.toThrow(/invite yourself/);
    await expect(invite(alex, "not-an-email")).rejects.toThrow(/check constraint/);
    await expect(
      db.as(alex, "select public.create_household_invite($1, $2)", [sam.email, "not-a-hash"]),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("only two people, one partnership", () => {
  it("won't let you invite anyone once you have a partner", async () => {
    await partner(alex, sam);
    await expect(invite(alex, stranger.email, 2)).rejects.toThrow(/already have a partner/);
    await expect(invite(sam, stranger.email, 2)).rejects.toThrow(/already have a partner/);
  });

  it("refuses a third member even if an admin tries", async () => {
    await partner(alex, sam);
    const { household_id } = await household(alex);
    await db.admin("delete from public.household_members where user_id = $1", [stranger.id]);
    await expect(
      db.admin("insert into public.household_members (household_id, user_id) values ($1, $2)", [
        household_id,
        stranger.id,
      ]),
    ).rejects.toThrow(/at most two people/);
  });

  it("won't let someone who already has a partner accept another invite", async () => {
    await partner(alex, sam);
    const taylor = await db.createUser("taylor@example.com");
    await invite(taylor, sam.email, 3);
    await expect(accept(sam, 3)).rejects.toThrow(/End your current partnership/);
  });
});

describe("ending the partnership", () => {
  it("keeps the household with its creator and gives the other partner a fresh one", async () => {
    await partner(alex, sam);
    const shared = (await household(alex)).household_id;

    await db.as(sam, "select public.end_partnership()");

    expect((await household(alex)).household_id).toBe(shared);
    expect((await household(alex)).members).toHaveLength(1);
    const samNow = await household(sam);
    expect(samNow.household_id).not.toBe(shared);
    expect(samNow.members).toEqual([expect.objectContaining({ user_id: sam.id })]);
  });

  it("works the same when the creator ends it", async () => {
    await partner(alex, sam);
    const shared = (await household(alex)).household_id;
    await db.as(alex, "select public.end_partnership()");
    expect((await household(alex)).household_id).toBe(shared);
    expect((await household(sam)).household_id).not.toBe(shared);
  });

  it("fails politely without a partner", async () => {
    await expect(db.as(alex, "select public.end_partnership()")).rejects.toThrow(
      /don't have a partner/,
    );
  });
});

describe("migrating an existing project", () => {
  it("gives users who signed up before the migration a household", async () => {
    const early = { id: "00000000-0000-4000-8000-0000000000aa", email: "early@example.com" };
    const fresh = await createTestDb({ usersBeforeMigrations: [early] });
    const { rows } = await fresh.as<{ h: Household }>(
      early,
      "select public.get_my_household() as h",
    );
    expect(rows[0]!.h.members).toEqual([
      expect.objectContaining({ user_id: early.id, is_me: true }),
    ]);
  });
});
