import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, fakeTokenHash, type TestDb, type TestUser } from "./testDb";

// Invite-only sign-up (decision 0043), against real Postgres: the waitlist, the admin's
// invite codes and the gate on new accounts.

const ADMIN_EMAIL = "saltylvn@gmail.com";
const DEMO_EMAIL = "demo@dialed-kitchen.vercel.app";

let db: TestDb;
let admin: TestUser;
let member: TestUser;

beforeEach(async () => {
  db = await createTestDb();
  admin = await db.createUser(ADMIN_EMAIL, "google", { invited: false });
  member = await db.createUser("member@example.com");
});

const join = (email: string, name = "Sam", note: string | null = null) =>
  db.as(null, "select public.join_waitlist($1, $2, $3)", [email, name, note]);

const waitlistId = async (email: string) =>
  (await db.admin<{ id: string }>("select id from public.waitlist where email = $1", [email]))
    .rows[0]!.id;

const approve = async (email: string, seed: number) =>
  db.as(admin, "select public.create_signup_invite($1, $2)", [
    await waitlistId(email),
    fakeTokenHash(seed),
  ]);

const redeem = async (seed: number, as: TestUser | null = null) =>
  (
    await db.as<{ email: string | null }>(as, "select public.redeem_signup_invite($1) as email", [
      fakeTokenHash(seed),
    ])
  ).rows[0]!.email;

describe("the sign-up gate", () => {
  it("refuses a new account with no invite code", async () => {
    await expect(
      db.createUser("stranger@example.com", "google", { invited: false }),
    ).rejects.toThrow(/Invite required/);
  });

  it("lets the admin and the demo account sign up without one", async () => {
    const fresh = await createTestDb();
    await fresh.createUser(ADMIN_EMAIL, "google", { invited: false });
    await fresh.createUser(DEMO_EMAIL, "email", { invited: false });
  });

  it("lets only Google make the admin's account (no password account with that email)", async () => {
    const fresh = await createTestDb();
    await expect(fresh.createUser(ADMIN_EMAIL, "email", { invited: false })).rejects.toThrow(
      /Only Google sign-in can create accounts/,
    );
  });

  it("waitlist → approve → redeem → sign up, and the code is then used up", async () => {
    await join("Friend@Example.com ", "Friend");
    await approve("friend@example.com", 1);
    // Approved but not yet entered on the sign-in page: still refused.
    await expect(db.createUser("friend@example.com", "google", { invited: false })).rejects.toThrow(
      /Invite required/,
    );

    expect(await redeem(1)).toBe("friend@example.com");
    await db.createUser("friend@example.com", "google", { invited: false });

    const { rows } = await db.admin<{ status: string; used: boolean }>(
      `select w.status, i.used_at is not null as used
       from public.waitlist w join public.signup_invites i on i.waitlist_id = w.id`,
    );
    expect(rows).toEqual([{ status: "joined", used: true }]);
    expect(await redeem(1)).toBeNull(); // single use
  });

  it("only works for the email it was made for", async () => {
    await join("friend@example.com");
    await approve("friend@example.com", 1);
    await redeem(1);
    await expect(
      db.createUser("someone-else@example.com", "google", { invited: false }),
    ).rejects.toThrow(/Invite required/);
  });

  it("expires after 7 days", async () => {
    await join("friend@example.com");
    await approve("friend@example.com", 1);
    await db.admin("update public.signup_invites set expires_at = now() - interval '1 second'");
    expect(await redeem(1)).toBeNull();
    await db.admin("update public.signup_invites set redeemed_at = now()");
    await expect(db.createUser("friend@example.com", "google", { invited: false })).rejects.toThrow(
      /Invite required/,
    );
  });

  it("approving again replaces the old code", async () => {
    await join("friend@example.com");
    await approve("friend@example.com", 1);
    await approve("friend@example.com", 2);
    expect(await redeem(1)).toBeNull();
    expect(await redeem(2)).toBe("friend@example.com");
  });

  it("keeps only the code's hash", async () => {
    await join("friend@example.com");
    await expect(
      db.as(admin, "select public.create_signup_invite($1, 'my-plain-code')", [
        await waitlistId("friend@example.com"),
      ]),
    ).rejects.toThrow(/check constraint/);
  });

  it("never promises more than 25 places (accounts + open codes)", async () => {
    for (let i = 3; i <= 24; i++) await db.createUser(`user${i}@example.com`);
    await join("a@example.com");
    await join("b@example.com");
    await approve("a@example.com", 1); // 24 accounts + 1 open code = 25
    await expect(approve("b@example.com", 2)).rejects.toThrow(/No places left/);
  });
});

describe("the waitlist", () => {
  it("anyone signed out can join; the same email twice is quietly ignored", async () => {
    await join("friend@example.com", "Friend", "Saw it on your portfolio");
    await join("FRIEND@example.com", "Someone else");
    const { rows } = await db.admin<{ name: string; note: string }>(
      "select name, note from public.waitlist",
    );
    expect(rows).toEqual([{ name: "Friend", note: "Saw it on your portfolio" }]);
  });

  it("refuses bad input", async () => {
    await expect(join("not-an-email")).rejects.toThrow(/check constraint/);
    await expect(join("a@example.com", "")).rejects.toThrow(/check constraint/);
    await expect(join("a@example.com", "Sam", "x".repeat(301))).rejects.toThrow(/check constraint/);
  });

  it("is hidden from everyone but the admin", async () => {
    await join("friend@example.com");
    await expect(db.as(null, "select * from public.waitlist")).rejects.toThrow(/permission denied/);
    expect((await db.as(member, "select * from public.waitlist")).rows).toEqual([]);
    expect((await db.as(member, "select * from public.signup_invites")).rows).toEqual([]);
    expect((await db.as(admin, "select email from public.waitlist")).rows).toEqual([
      { email: "friend@example.com" },
    ]);
  });

  it("can't be written to directly, even by the admin", async () => {
    await expect(
      db.as(null, "insert into public.waitlist (email, name) values ('x@example.com', 'X')"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(admin, "insert into public.waitlist (email, name) values ('x@example.com', 'X')"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(
        admin,
        "insert into public.signup_invites (email, code_hash) values ('x@example.com', $1)",
        [fakeTokenHash(9)],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("admin only", () => {
  it("only the admin can approve, see the overview or decline", async () => {
    await join("friend@example.com");
    const id = await waitlistId("friend@example.com");
    await expect(
      db.as(member, "select public.create_signup_invite($1, $2)", [id, fakeTokenHash(1)]),
    ).rejects.toThrow(/Only the admin/);
    await expect(
      db.as(null, "select public.create_signup_invite($1, $2)", [id, fakeTokenHash(1)]),
    ).rejects.toThrow(/permission denied/);
    await expect(db.as(member, "select * from public.admin_overview()")).rejects.toThrow(
      /Only the admin/,
    );
    await db.as(member, "update public.waitlist set status = 'declined'");
    await db.as(member, "delete from public.waitlist where id = $1", [id]);
    expect((await db.admin("select status from public.waitlist")).rows).toEqual([
      { status: "waiting" },
    ]);

    await db.as(admin, "update public.waitlist set status = 'declined' where id = $1", [id]);
    expect((await db.admin("select status from public.waitlist")).rows).toEqual([
      { status: "declined" },
    ]);
  });

  it("knows who the admin is", async () => {
    const isAdmin = async (u: TestUser) =>
      (await db.as<{ ok: boolean }>(u, "select public.am_i_admin() as ok")).rows[0]!.ok;
    expect(await isAdmin(admin)).toBe(true);
    expect(await isAdmin(member)).toBe(false);
    await expect(db.as(null, "select public.am_i_admin()")).rejects.toThrow(/permission denied/);
    await expect(db.as(member, "select * from private.admins")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("shows places used and left", async () => {
    await join("friend@example.com");
    await join("pal@example.com");
    await approve("friend@example.com", 1);
    const { rows } = await db.as(admin, "select * from public.admin_overview()");
    expect(rows).toEqual([{ accounts: 2, open_invites: 1, waiting: 1, account_limit: 25 }]);
  });
});
