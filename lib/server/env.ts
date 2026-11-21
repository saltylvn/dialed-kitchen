import "server-only";
import { z } from "zod";

// The app's settings from environment variables, checked once with a clear error instead
// of a confusing failure later. Everything here is read on the server only: the browser
// never talks to Neon directly (docs/decisions/0007, 0049), so nothing is NEXT_PUBLIC_.

const neonUrl = z
  .url({ protocol: /^https$/, hostname: /\.neon\.tech$/ })
  .transform((url) => url.replace(/\/+$/, ""));

const neonEnvSchema = z.object({
  // Neon Auth (sign-in) for this branch, e.g. https://ep-x.neonauth.….neon.tech/neondb/auth
  NEON_AUTH_BASE_URL: neonUrl,
  // Neon's Data API (queries) for this branch, e.g. https://ep-x.apirest.….neon.tech/neondb/rest/v1
  NEON_DATA_API_URL: neonUrl,
  // Signs the short-lived session cookie this app keeps. A secret: at least 32 characters.
  NEON_AUTH_COOKIE_SECRET: z.string().min(32, "must be at least 32 characters"),
});

export type NeonEnv = { authUrl: string; dataApiUrl: string; cookieSecret: string };

export function parseNeonEnv(source: Record<string, string | undefined>): NeonEnv {
  const result = neonEnvSchema.safeParse(source);
  if (!result.success) {
    // Names and reasons only: never echo a value, one of them is a secret.
    const problems = result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`);
    throw new Error(
      `Invalid Neon settings (set them in .env.local and in Vercel):\n- ${problems.join("\n- ")}`,
    );
  }
  return {
    authUrl: result.data.NEON_AUTH_BASE_URL,
    dataApiUrl: result.data.NEON_DATA_API_URL,
    cookieSecret: result.data.NEON_AUTH_COOKIE_SECRET,
  };
}

let cached: NeonEnv | undefined;

export function getNeonEnv(): NeonEnv {
  cached ??= parseNeonEnv({
    NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
    NEON_DATA_API_URL: process.env.NEON_DATA_API_URL,
    NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET,
  });
  return cached;
}

// The sign-up gate's own database login (db/migrations/…_signup_gate_role.sql): a secret,
// used only by the Neon Auth webhook. Null when not set; the webhook then refuses sign-ups.
export function signupGateDatabaseUrl(): string | null {
  const url = process.env.SIGNUP_GATE_DATABASE_URL?.trim();
  return url && /^postgres(ql)?:\/\//.test(url) ? url : null;
}
