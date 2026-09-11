/** 从明确的 Git 提交读取候选契约；未指定时保留相邻仓库的默认同步行为。 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export function backendContractSource(root, revision = process.env.BACKEND_CONTRACT_REF) {
  if (revision && !/^[a-f0-9]{40}$/.test(revision)) throw new Error("BACKEND_CONTRACT_REF 必须是完整40位提交SHA");
  const git = (args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  if (revision && git(["rev-parse", revision + "^{commit}"]).trim() !== revision) throw new Error("后端契约来源必须是精确提交");
  const file = (name) => {
    if (!/^[a-zA-Z0-9_.-]+\.json$/.test(name)) throw new Error("契约文件名无效");
    return "contracts/" + name;
  };
  return {
    committed: !!revision,
    description: revision ? "git:" + revision : "workspace:" + root,
    read(name) { const path = file(name); return revision ? git(["show", revision + ":" + path]) : readFileSync(resolve(root, path), "utf8"); },
    exists(name) {
      const path = file(name);
      if (!revision) return existsSync(resolve(root, path));
      try { git(["cat-file", "-e", revision + ":" + path]); return true; } catch { return false; }
    },
    list() { return revision ? git(["ls-tree", "--name-only", revision + ":contracts"]).trim().split("\n") : readdirSync(resolve(root, "contracts")); },
  };
}

export function assertBackendContract(source, name, expected) {
  if (source.committed && !source.exists(name)) throw new Error("已提交契约缺少 " + name);
  if (source.exists(name) && source.read(name) !== expected) {
    throw new Error(name + " 与后端契约来源 " + source.description + " 不一致；请同步同一已提交产物");
  }
}
