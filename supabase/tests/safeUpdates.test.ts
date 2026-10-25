import { describe, expect, it } from "vitest";
import { createTestDb } from "./testDb";

// Supabase refuses an UPDATE or DELETE that has no WHERE clause (its "safeupdate" guard
// against changing every row by accident). PGlite has no such guard, so a function that
// passes every test here could still fail live, as the first demo reset did (0026). This
// checks the final version of every function the app's migrations define.

function unboundedStatements(source: string): string[] {
  return source
    .replace(/--[^\n]*/g, "") // comments
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => /^(update\s+\S+\s+(\S+\s+)?set\b|delete\s+from\b)/i.test(s))
    .filter((s) => !/\bwhere\b/i.test(s));
}

describe("safe updates", () => {
  it("finds the unsafe forms it's meant to catch", () => {
    expect(unboundedStatements("update private.demo_state set x = 1;")).toHaveLength(1);
    expect(unboundedStatements("delete from public.items;")).toHaveLength(1);
    expect(unboundedStatements("update t set x = 1 where id; delete from t where a = b;")).toEqual(
      [],
    );
  });

  it("no database function updates or deletes without a WHERE clause", async () => {
    const db = await createTestDb();
    const { rows } = await db.admin<{ name: string; source: string }>(`
      select n.nspname || '.' || p.proname as name, p.prosrc as source
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
    `);
    expect(rows.length).toBeGreaterThan(20);
    const problems = rows.flatMap((r) =>
      unboundedStatements(r.source).map((s) => `${r.name}: ${s}`),
    );
    expect(problems).toEqual([]);
  });
});
