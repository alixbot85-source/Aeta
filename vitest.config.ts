import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "apps/api/test/**/*.test.ts"],
    testTimeout: 30000
  },
  resolve: {
    alias: {
      "@aeta/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@aeta/filesystem": path.resolve(__dirname, "packages/filesystem/src/index.ts"),
      "@aeta/terminal": path.resolve(__dirname, "packages/terminal/src/index.ts"),
      "@aeta/git": path.resolve(__dirname, "packages/git/src/index.ts"),
      "@aeta/ai": path.resolve(__dirname, "packages/ai/src/index.ts"),
      "@aeta/agent": path.resolve(__dirname, "packages/agent/src/index.ts")
    }
  }
});
