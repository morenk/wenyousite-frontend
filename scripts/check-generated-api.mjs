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
const backendContract = resolve(frontendRoot, "../wenyousite-backend/contracts/openapi.json");
const trackedContract = resolve(frontendRoot, "contracts/openapi.json");
const backendInternalReferenceContract = resolve(
  frontendRoot,
  "../wenyousite-backend/contracts/internal-reference-v1-fixtures.json",
);
const trackedInternalReferenceContract = resolve(
  frontendRoot,
  "contracts/internal-reference-v1-fixtures.json",
);
const backendEditorClipboardContract = resolve(
  frontendRoot,
  "../wenyousite-backend/contracts/editor-clipboard-v2-fixtures.json",
);
const trackedEditorClipboardContract = resolve(
  frontendRoot,
  "contracts/editor-clipboard-v2-fixtures.json",
);
const trackedTypes = resolve(frontendRoot, "src/api/types.ts");
const hooksRoot = resolve(frontendRoot, "src/api/hooks");
const tempRoot = mkdtempSync(join(tmpdir(), "wenyousite-api-contract-"));
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
  if (statSync(backendContract, { throwIfNoEntry: false })?.isFile() &&
      readFileSync(backendContract, "utf8") !== readFileSync(trackedContract, "utf8")) {
    throw new Error(
      "contracts/openapi.json 与相邻后端已审核产物不一致；请运行 pnpm contract:sync。",
    );
  }
  if (statSync(backendInternalReferenceContract, { throwIfNoEntry: false })?.isFile() &&
      readFileSync(backendInternalReferenceContract, "utf8")
        !== readFileSync(trackedInternalReferenceContract, "utf8")) {
    throw new Error(
      "contracts/internal-reference-v1-fixtures.json 与相邻后端已审核产物不一致；请运行 pnpm contract:sync。",
    );
  }
  if (statSync(backendEditorClipboardContract, { throwIfNoEntry: false })?.isFile() &&
      readFileSync(backendEditorClipboardContract, "utf8")
        !== readFileSync(trackedEditorClipboardContract, "utf8")) {
    throw new Error(
      "contracts/editor-clipboard-v2-fixtures.json 与相邻后端已审核产物不一致；请运行 pnpm contract:sync。",
    );
  }
  execFileSync(
    resolve(frontendRoot, "node_modules/.bin/openapi-typescript"),
    [trackedContract, "-o", generatedTypes],
    { cwd: frontendRoot, stdio: "inherit" },
  );

  if (readFileSync(trackedTypes, "utf8") !== readFileSync(generatedTypes, "utf8")) {
    throw new Error(
      "src/api/types.ts 与固定 OpenAPI 不一致；请运行 pnpm generate:api 并提交结果。",
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
