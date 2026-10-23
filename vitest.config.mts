import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The same "@/..." import shortcut the app uses (tsconfig.json "paths").
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // Database tests boot a real Postgres (PGlite) per test; give them room.
    testTimeout: 20_000,
  },
});
