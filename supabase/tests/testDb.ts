import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// A real Postgres (PGlite, compiled to WebAssembly) running in the test process, with the
// app's migrations applied. No Docker or network needed, so it also runs in CI.

const MIGRATIONS_DIR = new URL("../migrations/", import.meta.url);

// The small part of Supabase the migrations rely on: the auth.users table, auth.uid()
// (read from the request's JWT claims, exactly like Supabase does), and the API roles.
const SUPABASE_STAND_IN = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key, email text unique);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(
      coalesce(current_setting('request.jwt.claim.sub', true),
               (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')),
      '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated;
`;

export type TestUser = { id: string; email: string };

// `usersBeforeMigrations` simulates people who signed up before the migrations ran.
export async function createTestDb({ usersBeforeMigrations = [] as TestUser[] } = {}) {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STAND_IN);
  for (const user of usersBeforeMigrations) {
    await pg.query("insert into auth.users (id, email) values ($1, $2)", [user.id, user.email]);
  }

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    await pg.exec(readFileSync(new URL(file, MIGRATIONS_DIR), "utf8"));
  }

  let userCount = usersBeforeMigrations.length;

  return {
    pg,

    // Signs up a user the way Supabase Auth does: a row in auth.users.
    async createUser(email: string): Promise<TestUser> {
      userCount += 1;
      const id = `00000000-0000-4000-8000-${String(userCount).padStart(12, "0")}`;
      await pg.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
      return { id, email };
    },

    // Runs one query as a signed-in user (role "authenticated" with their JWT claims),
    // the way the app's server does through the Supabase API. RLS applies.
    async as<T = Record<string, unknown>>(
      user: TestUser | null,
      sql: string,
      params: unknown[] = [],
    ) {
      return pg.transaction(async (tx) => {
        const claims = user
          ? JSON.stringify({ sub: user.id, email: user.email, role: "authenticated" })
          : "";
        await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
        await tx.exec(`set local role ${user ? "authenticated" : "anon"}`);
        return tx.query<T>(sql, params);
      });
    },

    // Admin access (bypasses RLS), for setting up or inspecting test state.
    async admin<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      return pg.query<T>(sql, params);
    },
  };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

// A valid-looking token hash: 64 hex characters (what the app sends: SHA-256 of the token).
export function fakeTokenHash(seed: number): string {
  return seed.toString(16).padStart(64, "0");
}
