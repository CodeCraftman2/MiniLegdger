import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Tests share one real Postgres database, so run files one at a time.
    fileParallelism: false,
    setupFiles: ["test/setup.ts"],
    testTimeout: 15_000,
  },
});
