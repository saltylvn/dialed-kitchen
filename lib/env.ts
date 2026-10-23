import { z } from "zod";

// The app's settings from environment variables, checked once with a clear error
// instead of a confusing failure later. Only public-safe values live here; a secret
// key pasted into the wrong variable is rejected outright.
const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .url({ protocol: /^https$/, hostname: /\.supabase\.co$/ })
    .transform((url) => url.replace(/\/+$/, "")),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .refine((key) => !key.startsWith("sb_secret_"), {
      message: "is a SECRET key. Use the publishable key (sb_publishable_...) instead",
    })
    .refine((key) => key.startsWith("sb_publishable_"), {
      message: "must be the publishable key (starts with sb_publishable_)",
    }),
});

export type SupabaseEnv = { url: string; publishableKey: string };

export function parseSupabaseEnv(source: Record<string, string | undefined>): SupabaseEnv {
  const result = supabaseEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`);
    throw new Error(
      `Invalid Supabase settings (set them in .env.local and in Vercel):\n- ${problems.join("\n- ")}`,
    );
  }
  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

let cached: SupabaseEnv | undefined;

export function getSupabaseEnv(): SupabaseEnv {
  // Listed by name so Next.js can include the NEXT_PUBLIC_ values in the build.
  cached ??= parseSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return cached;
}
