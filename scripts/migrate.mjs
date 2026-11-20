// Applies the SQL files in db/migrations/ to the database, in name order, each one once.
//
//   npm run db:status   what has been applied and what is waiting (changes nothing)
//   npm run db:migrate  apply what is waiting
//
// The connection string comes from the Neon CLI for the branch this folder is linked to
// (`neon link`), or from DATABASE_URL when set (CI, or to aim at another branch). Each file
// runs inside one transaction together with the note that it ran, so a file either applies
// completely or not at all. Applied files are remembered in migrations.applied.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { Client } from "@neondatabase/serverless";

const DIR = new URL("../db/migrations/", import.meta.url);
const dryRun = !process.argv.includes("--apply");

function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    // The owner's (unpooled) connection: migrations need one steady session.
    return execFileSync("neon", ["connection-string"], { encoding: "utf8" }).trim();
  } catch {
    throw new Error("Set DATABASE_URL, or run `neon link` in this folder first.");
  }
}

const client = new Client({ connectionString: connectionString() });
await client.connect();
try {
  const { rows: where } = await client.query(
    "select current_database() as db, current_user as usr",
  );
  await client.query(`
    create schema if not exists migrations;
    create table if not exists migrations.applied (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const { rows } = await client.query("select name from migrations.applied");
  const applied = new Set(rows.map((r) => r.name));
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const waiting = files.filter((f) => !applied.has(f));

  console.log(
    `Database ${where[0].db} as ${where[0].usr}: ${applied.size} applied, ${waiting.length} waiting.`,
  );
  for (const file of waiting) {
    if (dryRun) {
      console.log(`  would apply ${file}`);
      continue;
    }
    await client.query("begin");
    try {
      await client.query(readFileSync(new URL(file, DIR), "utf8"));
      await client.query("insert into migrations.applied (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`  applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`${file} failed and was rolled back: ${error.message}`, { cause: error });
    }
  }
  if (dryRun && waiting.length > 0)
    console.log("Nothing was changed. Apply with: npm run db:migrate");
} finally {
  await client.end();
}
