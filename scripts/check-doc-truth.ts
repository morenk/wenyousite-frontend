/** 文档真实性门禁：模块索引、架构禁语与 API 覆盖数字必须由当前源码推导。 */

import * as fs from "node:fs";
import * as path from "node:path";

const root = process.cwd();
const openapiPath = path.resolve(root, "contracts/openapi.json");

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(file);
    }
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [file] : [];
  });
}

function markdownFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(file);
    return entry.isFile() && entry.name.endsWith(".md") ? [file] : [];
  });
}

function operation(method: string, apiPath: string) {
  return `${method.toUpperCase()} ${apiPath}`;
}

{
  const spec = JSON.parse(fs.readFileSync(openapiPath, "utf8")) as {
    paths: Record<string, Record<string, unknown>>;
  };
  const methods = ["get", "post", "put", "patch", "delete"];
  const allOperations = new Set<string>();
  for (const [apiPath, pathItem] of Object.entries(spec.paths)) {
    for (const method of methods) {
      if (pathItem[method]) allOperations.add(operation(method, apiPath));
    }
  }

  const excluded = new Set(
    [...allOperations].filter(
      (item) =>
        item.includes(" /api/v1/reports") || item.includes(" /api/v1/admin"),
    ),
  );
  const userOperations = new Set(
    [...allOperations].filter((item) => !excluded.has(item)),
  );

  const directOperations = new Set<string>();
  const callPattern =
    /apiClient\.(GET|POST|PUT|PATCH|DELETE)\(\s*["']([^"']+)["']/g;
  for (const file of sourceFiles(path.resolve(root, "src"))) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(callPattern)) {
      directOperations.add(operation(match[1], match[2]));
    }
  }
  // refresh 使用原生 fetch 包装器，以避免拦截器递归。
  directOperations.add("POST /api/v1/auth/refresh");

  const missing = [...userOperations]
    .filter((item) => !directOperations.has(item))
    .sort();
  const coverageDocument = fs.readFileSync(
    path.resolve(root, "docs/api-coverage.md"),
    "utf8",
  );
  const auditSection = coverageDocument
    .split("## 未单独调用的用户端操作")[1]
    ?.split("## 后续边界")[0];
  if (!auditSection) throw new Error("docs/api-coverage.md 缺少未调用操作章节");
  const documentedMissing = [...auditSection.matchAll(/^\| `((?:GET|POST|PUT|PATCH|DELETE) \/api\/v1\/[^`]+)` \|/gm)]
    .map((match) => match[1])
    .sort();

  const expectedFacts = [
    `后端总量：${Object.keys(spec.paths).length} 个路径、${allOperations.size} 个操作`,
    `本轮明确搁置：举报 3 个操作、管理后台 5 个操作`,
    `用户端审计范围：${userOperations.size} 个操作`,
    `前端直接调用：${directOperations.size} 个操作；其余 ${missing.length} 个操作`,
  ];
  const failures = expectedFacts
    .filter((fact) => !coverageDocument.includes(fact))
    .map((fact) => `docs/api-coverage.md 缺少当前事实：${fact}`);
  if (JSON.stringify(documentedMissing) !== JSON.stringify(missing)) {
    failures.push(
      `未单独调用操作表与源码不一致：\n期望 ${missing.join("\n")}\n文档 ${documentedMissing.join("\n")}`,
    );
  }

  const docsIndex = fs.readFileSync(path.resolve(root, "docs/README.md"), "utf8");
  for (const name of fs
    .readdirSync(path.resolve(root, "docs/modules"))
    .filter((file) => file.endsWith(".md"))) {
    if (!docsIndex.includes(`./modules/${name}`)) {
      failures.push(`docs/README.md 未索引 docs/modules/${name}`);
    }
  }

  const architectureDocs = [
    path.resolve(root, "AGENTS.md"),
    path.resolve(root, "README.md"),
    ...markdownFiles(path.resolve(root, "docs")),
  ];
  const forbiddenClaims = [
    /`accessToken` 存在 `localStorage`/,
    /暂不拦截（后续用 middleware）/,
    /queryKey\s+`\[/,
  ];
  for (const file of architectureDocs) {
    const source = fs.readFileSync(file, "utf8");
    for (const claim of forbiddenClaims) {
      if (claim.test(source)) {
        failures.push(`${path.relative(root, file)} 仍包含历史架构表述：${claim}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`文档真实性检查失败：\n${failures.join("\n")}`);
  }
  console.log(
    `Documentation facts match ${allOperations.size} OpenAPI operations and ${directOperations.size} frontend calls`,
  );
}
