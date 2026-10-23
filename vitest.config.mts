import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The same "@/..." import shortcut the app uses (tsconfig.json "paths").
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // Lets tests import server-only modules (the real package throws outside Next.js).
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    // Database tests boot a real Postgres (PGlite) and apply every migration before each
    // test (in beforeEach, a "hook"); with several files at once that can pass the default
    // 10 seconds, so tests and hooks both get room.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
