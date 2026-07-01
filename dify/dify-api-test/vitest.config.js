import { defineConfig } from "vitest/config";

const testTimeout = Number(process.env.VITEST_TEST_TIMEOUT || 120000);

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    testTimeout,
    hookTimeout: testTimeout,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    sequence: {
      concurrent: false
    },
    fileParallelism: false
  }
});
