import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { backendContractSource, assertBackendContract } from "./backend-contract-source.mjs";

let root: string;
let revision: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "wenyou-cover-contract-test-"));
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  git("config", "user.name", "Contract Test"); git("config", "user.email", "contract@example.invalid");
  mkdirSync(join(root, "contracts"));
  writeFileSync(join(root, "contracts/openapi.json"), "committed");
  git("add", "contracts/openapi.json"); git("commit", "-qm", "fixture");
  revision = git("rev-parse", "HEAD").trim();
  writeFileSync(join(root, "contracts/openapi.json"), "uncommitted");
});
afterAll(() => rmSync(root, { recursive: true }));

describe("明确提交的后端契约来源", () => {
  test("读取已提交字节，不误用工作区改动；默认来源保留相邻工作区语义", () => {
    const source = backendContractSource(root, revision);
    expect(source.read("openapi.json")).toBe("committed");
    expect(source.list()).toEqual(["openapi.json"]);
    expect(source.description).toContain(revision);
    expect(backendContractSource(root, "").read("openapi.json")).toBe("uncommitted");
    expect(() => assertBackendContract(source, "openapi.json", "committed")).not.toThrow();
  });
  test("拒绝缩写、分支名、非提交SHA、路径穿越和不匹配产物", () => {
    expect(() => backendContractSource(root, "dev")).toThrow();
    expect(() => backendContractSource(root, revision.slice(0, 7))).toThrow();
    expect(() => backendContractSource(root, "0".repeat(40))).toThrow();
    const source = backendContractSource(root, revision);
    expect(() => source.read("../openapi.json")).toThrow();
    expect(() => assertBackendContract(source, "openapi.json", "uncommitted")).toThrow(/不一致/);
    expect(() => assertBackendContract(source, "missing.json", "anything")).toThrow(/缺少/);
  });
});
