import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const globalCss = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("页面切换布局稳定性", () => {
  test("根滚动容器始终保留纵向滚动条空间", () => {
    expect(globalCss).toMatch(/html\s*\{[^}]*scrollbar-gutter:\s*stable;/);
    expect(globalCss).toMatch(
      /@supports not \(scrollbar-gutter:\s*stable\)\s*\{\s*html\s*\{[^}]*overflow-y:\s*scroll;/,
    );
  });
});
