/** OpenAPI 契约门禁：生成到临时目录并与跟踪类型比较，同时禁止 hooks 恢复影子响应类型。 */

import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const frontendRoot = process.cwd();
const backendRoot = resolve(frontendRoot, "../wenyousite-backend");
const trackedTypes = resolve(frontendRoot, "src/api/types.ts");
const hooksRoot = resolve(frontendRoot, "src/api/hooks");
const tempRoot = mkdtempSync(join(tmpdir(), "wenyousite-api-contract-"));
const openapiPath = join(tempRoot, "openapi.json");
const generatedTypes = join(tempRoot, "types.ts");

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(path);
    }
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

try {
  execFileSync(
    "pnpm",
    ["--dir", backendRoot, "openapi:export", openapiPath],
    { cwd: frontendRoot, stdio: "inherit" },
  );
  execFileSync(
    resolve(frontendRoot, "node_modules/.bin/openapi-typescript"),
    [openapiPath, "-o", generatedTypes],
    { cwd: frontendRoot, stdio: "inherit" },
  );

  if (readFileSync(trackedTypes, "utf8") !== readFileSync(generatedTypes, "utf8")) {
    throw new Error(
      "src/api/types.ts 与后端 OpenAPI 不一致；请运行 pnpm generate:api 并提交结果。",
    );
  }

  const hookFailures = sourceFiles(hooksRoot).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const failures = [];
    if (source.includes("as unknown as")) failures.push("包含 as unknown as");
    if (/interface\s+\w*Response\b/.test(source)) {
      failures.push("手写 Response interface");
    }
    return failures.map((failure) => `${file}: ${failure}`);
  });
  if (hookFailures.length > 0) {
    throw new Error(`API hooks 必须使用生成契约：\n${hookFailures.join("\n")}`);
  }

  console.log("OpenAPI generated types are current and API hooks use generated contracts");
} finally {
  if (statSync(tempRoot).isDirectory()) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
