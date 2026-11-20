// Gives the sign-up gate's database role (signup_gate, see db/migrations) a new random
// password and saves its connection string as SIGNUP_GATE_DATABASE_URL in .env.local.
// Nothing secret is printed. Run it again any time to rotate the password; then copy the
// new value to Vercel with: sh scripts/vercel-secret.sh SIGNUP_GATE_DATABASE_URL
//
//   npm run db:gate-password
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Client } from "@neondatabase/serverless";

const ENV_FILE = new URL("../.env.local", import.meta.url);
const NAME = "SIGNUP_GATE_DATABASE_URL";

const neon = (...args) => execFileSync("neon", args, { encoding: "utf8" }).trim();
const ownerUrl = process.env.DATABASE_URL ?? neon("connection-string");
// The pooled address: right for short, one-question connections from serverless functions.
const pooledUrl = new URL(neon("connection-string", "--pooled"));

// Hex only, so it is safe inside the SQL text and the connection string as it is.
const password = randomBytes(32).toString("hex");

const client = new Client({ connectionString: ownerUrl });
await client.connect();
try {
  // ALTER ROLE can't take the password as a parameter; it is hex we just generated.
  await client.query(`alter role signup_gate with login password '${password}'`);
} finally {
  await client.end();
}

pooledUrl.username = "signup_gate";
pooledUrl.password = password;
const line = `${NAME}=${pooledUrl.toString()}`;

const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const kept = current.split("\n").filter((l) => !l.startsWith(`${NAME}=`));
while (kept.length > 0 && kept.at(-1) === "") kept.pop();
writeFileSync(ENV_FILE, [...kept, line, ""].join("\n"), { mode: 0o600 });

console.log(`signup_gate has a new password; ${NAME} saved to .env.local (not shown).`);
