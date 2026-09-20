import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // `?modulePath` is how the application build asks for a worker's emitted
    // file. Tests import the worker module, which exports its own path.
    alias: [{ find: /^(.*)\?modulePath$/, replacement: "$1" }],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
