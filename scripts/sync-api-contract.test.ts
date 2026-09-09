// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";

const script = resolve("scripts/sync-api-contract.mjs");
const roots: string[] = [];
function workspace() {
  const root = mkdtempSync(join(tmpdir(), "wenyou-contract-sync-"));
  roots.push(root);
  const backend = join(root, "wenyousite-backend/contracts");
  const frontend = join(root, "wenyousite-frontend");
  mkdirSync(backend, { recursive: true });
  mkdirSync(join(frontend, "contracts"), { recursive: true });
  const fixtures = {
    "rich-text-behavior-v1-fixtures.json": { contract: "wenyousite-rich-text-behavior", version: 1, revision: 2 },
    "rich-text-behavior-v1.schema.json": { $schema: "http://json-schema.org/draft-07/schema#" },
    "rich-text-behavior-results-v1.schema.json": { $schema: "http://json-schema.org/draft-07/schema#" },
    "markdown-editor-newline-v1-fixtures.json": { contract: "wenyousite-editor-newline", version: 1 },
    "openapi.json": { openapi: "3.0.3", info: { version: "test" } },
    "internal-reference-v1-fixtures.json": { contract: "wenyousite-internal-reference", version: 1 },
    "editor-clipboard-v2-fixtures.json": { contract: "wenyousite-editor-clipboard", version: 2 },
    "markdown-v4-fixtures.json": { contract: "wenyousite-markdown", version: 4 },
    "markdown-v4-nodes-fixtures.json": { contract: "wenyousite-markdown-nodes", version: 1 },
    "markdown-editor-roundtrip-v7-fixtures.json": { contract: "wenyousite-markdown-editor-roundtrip", version: 7 },
    "markdown-v5-image-alignment-fixtures.json": { contract: "wenyousite-markdown-image-alignment", version: 2 },
  };
  for (const [name, value] of Object.entries(fixtures)) writeFileSync(join(backend, name), JSON.stringify(value));
  writeFileSync(join(frontend, "contracts/markdown-editor-roundtrip-v6-fixtures.json"), "old");
  writeFileSync(join(frontend, "contracts/private-notes.txt"), "keep");
  return { frontend, backend, fixtures };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("同步全部 Markdown 事实源，只淘汰旧版 fixture，重复同步不变", () => {
  const { frontend, backend, fixtures } = workspace();
  for (let pass = 0; pass < 2; pass++) {
    execFileSync(process.execPath, [script], { cwd: frontend });
    for (const name of Object.keys(fixtures)) {
      expect(readFileSync(join(frontend, "contracts", name), "utf8"))
        .toBe(readFileSync(join(backend, name), "utf8"));
    }
    expect(existsSync(join(frontend, "contracts/markdown-editor-roundtrip-v6-fixtures.json"))).toBe(false);
    expect(readFileSync(join(frontend, "contracts/private-notes.txt"), "utf8")).toBe("keep");
  }
});

test("来源损坏时在覆盖或清理前拒绝", () => {
  const { frontend, backend } = workspace();
  writeFileSync(join(backend, "markdown-v5-image-alignment-fixtures.json"), "{}");
  expect(() => execFileSync(process.execPath, [script], { cwd: frontend, stdio: "pipe" })).toThrow();
  expect(readFileSync(join(frontend, "contracts/markdown-editor-roundtrip-v6-fixtures.json"), "utf8")).toBe("old");
  expect(existsSync(join(frontend, "contracts/openapi.json"))).toBe(false);
});
