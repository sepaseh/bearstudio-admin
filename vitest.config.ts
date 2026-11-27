import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  test: {
    clearMocks: true,
    restoreMocks: true,
    include: ["scripts/run-audit.test.mjs"],
    coverage: {
      include: ["scripts/run-audit.mjs"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage/unit",
    },
  },
});
