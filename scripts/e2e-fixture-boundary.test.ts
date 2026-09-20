// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";
import { requireIsolationRunner } from "./e2e-isolation-gate.mjs";

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : file.endsWith(".ts") ? [file] : [];
  });
}

test("全部 E2E 入口统一继承隔离 fixture，不能恢复裸 Playwright test", () => {
  const violations: string[] = [];
  for (const file of sourceFiles("e2e")) {
    if (relative("e2e", file) === "fixtures/isolation.ts") continue;
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
        || statement.moduleSpecifier.text !== "@playwright/test") continue;
      const binding = statement.importClause?.namedBindings;
      if (binding && (!ts.isNamedImports(binding)
        || binding.elements.some((element) => (element.propertyName ?? element.name).text === "test"))) violations.push(file);
    }
  }
  expect(violations).toEqual([]);
});

test("缺少已提交隔离协议时不允许环境变量自证或继续写入", () => {
  expect(() => requireIsolationRunner()).toThrow("写入型 E2E 已关闭");
});
