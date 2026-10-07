import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each store test starts its own in-memory Postgres (WASM), which takes seconds when several test
    // files run at once. Fewer workers also keeps memory use down.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    maxWorkers: 2,
  },
});
