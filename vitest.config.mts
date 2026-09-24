import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    // tests/e2e/** are Playwright specs (run via `pnpm test:e2e`).
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
    setupFiles: ["./src/test/setup-dom.ts"],
  },
});
