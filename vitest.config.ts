import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/api/types.ts"],
      thresholds: {
        statements: 74,
        branches: 68,
        functions: 77,
        lines: 78,
        "src/api/hooks/admin/**": {
          statements: 82,
          branches: 57,
          functions: 95,
          lines: 95,
        },
        "src/components/admin/**": {
          statements: 48,
          branches: 41,
          functions: 40,
          lines: 51,
        },
        "src/components/moment/**": {
          statements: 84,
          branches: 78,
          functions: 75,
          lines: 86,
        },
        "src/components/thread/**": {
          statements: 89,
          branches: 84,
          functions: 90,
          lines: 91,
        },
        "src/lib/**": {
          statements: 90,
          branches: 84,
          functions: 91,
          lines: 94,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
