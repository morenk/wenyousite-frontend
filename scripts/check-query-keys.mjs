/** 查询缓存门禁：业务代码只能通过 src/api/query-keys.ts 构造 TanStack Query key。 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = process.cwd();
const sourceRoot = resolve(root, "src");

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(path);
    }
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const forbidden = [
  { label: "queryKey 使用字面量数组", pattern: /queryKey\s*:\s*\[/g },
  {
    label: "QueryClient 方法使用字面量数组",
    pattern:
      /(?:invalidateQueries|refetchQueries|setQueryData|getQueryData|removeQueries|cancelQueries)\s*\(\s*\[/g,
  },
  {
    label: "access token 不得写入 localStorage",
    pattern:
      /localStorage\.(?:getItem|setItem|removeItem)\(\s*["']accessToken["']/g,
  },
];

const failures = sourceFiles(sourceRoot).flatMap((file) => {
  if (file.endsWith("/api/query-keys.ts") || file.endsWith("/api/types.ts")) return [];
  const source = readFileSync(file, "utf8");
  return forbidden.flatMap(({ label, pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(source) ? [`${relative(root, file)}: ${label}`] : [];
  });
});

for (const layer of ["app", "components"]) {
  for (const file of sourceFiles(resolve(sourceRoot, layer))) {
    const source = readFileSync(file, "utf8");
    const uiPath = relative(root, file);
    if (/from\s+["']@\/api\/client["']/.test(source)) {
      failures.push(
        `${relative(root, file)}: UI 层直接依赖 apiClient，请下沉到 API hook`,
      );
    }
    const queryClientUiAllowlist = new Set([
      "src/components/editor/use-editor-draft-controller.ts",
      "src/components/thread/thread-card.tsx",
    ]);
    if (source.includes("useQueryClient") && !queryClientUiAllowlist.has(uiPath)) {
      failures.push(
        `${uiPath}: UI mutation 不应编排缓存，请在领域 hook 的 onSuccess 中处理`,
      );
    }
    if (
      /src\/components\/(?:ui|shared)\//.test(uiPath) &&
      /from\s+["']@\/(?:api\/hooks|components\/(?:editor|forms|message|thread|user))\//.test(source)
    ) {
      failures.push(`${uiPath}: 通用组件不得反向依赖业务模块`);
    }
    if (
      uiPath.startsWith("src/components/editor/") &&
      /from\s+["']@\/components\/user\//.test(source)
    ) {
      failures.push(`${uiPath}: 编辑器模块不得依赖用户展示模块`);
    }
    if (
      uiPath.startsWith("src/components/message/") &&
      /from\s+["']@\/components\/thread\//.test(source)
    ) {
      failures.push(`${uiPath}: 私聊模块不得依赖主题帖展示模块`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(
    `查询键必须从 src/api/query-keys.ts 获取：\n${failures.join("\n")}`,
  );
}

console.log("Query keys, UI API access, cache orchestration, and component imports follow layer boundaries");
