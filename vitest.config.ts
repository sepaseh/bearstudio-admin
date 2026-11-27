import { defineConfig } from "vitest/config";
import { srcPath } from "./tooling/paths.ts";

export default defineConfig({
  envDir: false,
  resolve: { alias: { "@": srcPath } },
  test: {
    clearMocks: true,
    restoreMocks: true,
    env: {
      VITE_API_BASE_URL: "http://localhost",
      VITE_RELEASE_ID: "synthetic-preparation-verification",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "prepared-modules",
          environment: "jsdom",
          environmentOptions: { jsdom: { url: "http://localhost/" } },
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/shared/api/transport.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "tooling",
          environment: "node",
          include: [
            "scripts/run-audit.test.mjs",
            "src/shared/api/transport.test.ts",
          ],
        },
      },
    ],
    coverage: {
      include: ["scripts/run-audit.mjs", "src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/**/*.d.ts"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage/unit",
    },
  },
});
