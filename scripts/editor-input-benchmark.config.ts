import { defineConfig } from "vitest/config";
import path from "node:path";

// 独立微基准：使用真实编码器和受控时钟，不参与覆盖率门禁或浏览器体感验收。
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["scripts/editor-input-benchmark.bench.ts"],
    maxWorkers: 1,
    testTimeout: 30_000,
  },
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
});
