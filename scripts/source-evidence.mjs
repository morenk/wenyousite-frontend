import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** 将未暂存删除纳入证据；其他读取错误仍使候选验收失败。 */
export function evidenceSource(directory = process.cwd()) {
  const git = (...args) => execFileSync("git", args, { cwd: directory, encoding: "utf8" });
  const files = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean).sort();
  const deleted = new Set(git("ls-files", "--deleted", "-z").split("\0").filter(Boolean));
  const digest = createHash("sha256");
  for (const file of files) {
    digest.update(file);
    digest.update("\0");
    if (deleted.has(file)) {
      digest.update("deleted\0");
    } else {
      digest.update("present\0");
      digest.update(readFileSync(join(directory, file)));
    }
  }
  return { sourceCommit: git("rev-parse", "HEAD").trim(), sourceDigest: digest.digest("hex") };
}
