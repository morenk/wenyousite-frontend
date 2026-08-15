/** 生产源码架构门禁：依赖方向、循环依赖与已拆分热点文件的规模。 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = process.cwd();
const sourceRoot = resolve(root, "src");

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(file);
    }
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [file] : [];
  });
}

const files = sourceFiles(sourceRoot);
const fileSet = new Set(files);
const failures = [];

function resolveImport(importer, specifier) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return null;
  const base = specifier.startsWith("@/")
    ? resolve(sourceRoot, specifier.slice(2))
    : resolve(dirname(importer), specifier);
  const candidates = extname(base)
    ? [base]
    : [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

const graph = new Map();
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const relativePath = relative(root, file);
  const dependencies = [];
  for (const match of source.matchAll(importPattern)) {
    const dependency = resolveImport(file, match[1] ?? match[2]);
    if (dependency) dependencies.push(dependency);
  }
  graph.set(file, dependencies);

  if (relativePath.startsWith("src/api/") && dependencies.some((item) =>
    item.startsWith(resolve(sourceRoot, "app")) || item.startsWith(resolve(sourceRoot, "components")),
  )) {
    failures.push(`${relativePath}: API 层不得依赖 app/components`);
  }
  if (relativePath.startsWith("src/lib/") && dependencies.some((item) =>
    item.startsWith(resolve(sourceRoot, "app")) || item.startsWith(resolve(sourceRoot, "components")),
  )) {
    failures.push(`${relativePath}: lib 层不得反向依赖 app/components`);
  }
  if (/^src\/components\/(?:ui|shared)\//.test(relativePath) && dependencies.some((item) => {
    const dependencyPath = relative(root, item);
    return dependencyPath.startsWith("src/api/hooks/") ||
      /^src\/components\/(?:admin|editor|forms|message|moment|notification|search|sticker|thread|user)\//.test(dependencyPath);
  })) {
    failures.push(`${relativePath}: 通用组件不得依赖 API hook 或业务组件`);
  }
}

const visiting = new Set();
const visited = new Set();
const stack = [];
const reportedCycles = new Set();

function visit(file) {
  if (visited.has(file)) return;
  if (visiting.has(file)) {
    const start = stack.indexOf(file);
    const cycle = [...stack.slice(start), file].map((item) => relative(root, item));
    const key = [...new Set(cycle)].sort().join("|");
    if (!reportedCycles.has(key)) {
      reportedCycles.add(key);
      failures.push(`循环依赖：${cycle.join(" -> ")}`);
    }
    return;
  }
  visiting.add(file);
  stack.push(file);
  for (const dependency of graph.get(file) ?? []) visit(dependency);
  stack.pop();
  visiting.delete(file);
  visited.add(file);
}

for (const file of files) visit(file);

const hotspotLimits = new Map([
  ["src/api/hooks/use-admin.ts", 40],
  ["src/components/moment/moment-comments.tsx", 420],
  ["src/components/thread/use-management-panel-controller.ts", 520],
  ["src/components/editor/milkdown-editor-core.tsx", 260],
]);
for (const [relativePath, maximum] of hotspotLimits) {
  const file = resolve(root, relativePath);
  if (!existsSync(file)) {
    failures.push(`${relativePath}: 架构热点入口不存在`);
    continue;
  }
  const lines = readFileSync(file, "utf8").split("\n").length;
  if (lines > maximum) {
    failures.push(`${relativePath}: ${lines} 行，超过拆分后上限 ${maximum}`);
  }
}

if (failures.length > 0) {
  throw new Error(`架构检查失败：\n${failures.join("\n")}`);
}

console.log(`Architecture boundaries and dependency graph are valid (${files.length} production files)`);
