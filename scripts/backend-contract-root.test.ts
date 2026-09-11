// @vitest-environment node
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("指定后端来源必须存在且逐字校验，不回退相邻 checkout", () => {
  const root = mkdtempSync(join(tmpdir(), "wenyou-backend-source-"));
  roots.push(root);
  const contracts = join(root, "contracts");
  mkdirSync(contracts);
  for (const name of ["openapi.json", "internal-reference-v1-fixtures.json", "editor-clipboard-v2-fixtures.json"]) {
    copyFileSync(resolve("contracts", name), join(contracts, name));
  }
  const run = (source: string) => execFileSync(process.execPath, [resolve("scripts/check-generated-api.mjs")], {
    cwd: process.cwd(), env: { ...process.env, WENYOUSITE_BACKEND_ROOT: source }, encoding: "utf8", stdio: "pipe",
  });
  expect(run(root)).toContain("OpenAPI generated types are current");
  writeFileSync(join(contracts, "openapi.json"), "{}");
  expect(() => run(root)).toThrow(/OpenAPI|openapi/u);
  expect(() => run(join(root, "missing"))).toThrow(/缺少 contracts/u);
  rmSync(join(contracts, "openapi.json"));
  expect(() => run(root)).toThrow(/指定后端来源缺少契约/u);
});
