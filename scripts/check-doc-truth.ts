/** 文档真实性门禁：模块索引、架构禁语与 API 覆盖数字必须由当前源码推导。 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  EDITOR_CAPABILITY_LABELS,
  EDITOR_CONTENT_POLICY,
  EDITOR_CREATABLE_HEADING_LEVELS,
  EDITOR_MORE_FALLBACK,
  EDITOR_MORE_PROGRESSIVE,
  EDITOR_PRIMARY_NARROW,
  EDITOR_PRIMARY_WIDE,
  editorCapabilityLabels,
} from "../src/lib/editor-capabilities";

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
  const reportOperations = [...allOperations].filter((item) =>
    item.includes(" /api/v1/reports"),
  );
  const adminOperations = [...allOperations].filter((item) =>
    item.includes(" /api/v1/admin"),
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

  const directKnownOperations = new Set(
    [...directOperations].filter((item) => allOperations.has(item)),
  );
  const directUserOperations = [...directKnownOperations].filter((item) =>
    userOperations.has(item),
  );
  const directExcludedOperations = [...directKnownOperations].filter((item) =>
    excluded.has(item),
  );
  const missing = [...userOperations]
    .filter((item) => !directKnownOperations.has(item))
    .sort();
  const missingExcluded = [...excluded]
    .filter((item) => !directKnownOperations.has(item))
    .sort();
  const coverageDocument = fs.readFileSync(
    path.resolve(root, "docs/api-coverage.md"),
    "utf8",
  );
  const auditSection = coverageDocument
    .split("## 未单独调用的用户端操作")[1]
    ?.split("## 范围边界")[0];
  if (!auditSection) throw new Error("docs/api-coverage.md 缺少未调用操作章节");
  const documentedMissing = [
    ...auditSection.matchAll(
      /^\| `((?:GET|POST|PUT|PATCH|DELETE) \/api\/v1\/[^`]+)` \|/gm,
    ),
  ]
    .map((match) => match[1])
    .sort();

  const expectedFacts = [
    `后端总量：${Object.keys(spec.paths).length} 个路径、${allOperations.size} 个操作`,
    `用户端范围外：举报 ${reportOperations.length} 个操作、管理后台 ${adminOperations.length} 个操作`,
    `用户端审计范围：${userOperations.size} 个操作`,
    `Web 源码直接引用：${directKnownOperations.size} 个操作（用户端 ${directUserOperations.length} 个，举报/站务 ${directExcludedOperations.length} 个）`,
    `未直接引用：用户端 ${missing.length} 个、举报/站务 ${missingExcluded.length} 个`,
  ];
  const failures = expectedFacts
    .filter((fact) => !coverageDocument.includes(fact))
    .map((fact) => `docs/api-coverage.md 缺少当前事实：${fact}`);
  if (JSON.stringify(documentedMissing) !== JSON.stringify(missing)) {
    failures.push(
      `未单独调用操作表与源码不一致：\n期望 ${missing.join("\n")}\n文档 ${documentedMissing.join("\n")}`,
    );
  }

  const docsIndex = fs.readFileSync(
    path.resolve(root, "docs/README.md"),
    "utf8",
  );
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
    /没有草稿喔/,
    /顶栏入口统一改名为“消息”/,
    /全局导航栏不展示收藏入口/,
    /Flutter 后续必须/,
    /z\.enum\(\["DEDUCTION", "NATION", "RPG"\]\)/,
    /目录菜单打开后焦点直接进入搜索框/,
    /弹出可检索固定高度纵向菜单/,
    /骰子入口.*工具栏收纳时进入“更多”/,
  ];
  for (const file of architectureDocs) {
    const source = fs.readFileSync(file, "utf8");
    for (const claim of forbiddenClaims) {
      if (claim.test(source)) {
        failures.push(
          `${path.relative(root, file)} 仍包含历史架构表述：${claim}`,
        );
      }
    }
  }

  const currentGuides = [
    path.resolve(root, "docs/design-system.md"),
    ...markdownFiles(path.resolve(root, "docs/modules")),
  ];

  const retiredSnapshotDirectory = path.resolve(root, "docs/snapshots");
  if (
    fs.existsSync(retiredSnapshotDirectory) &&
    fs.readdirSync(retiredSnapshotDirectory).some((name) => name.endsWith(".snapshot.json"))
  ) {
    failures.push("docs/snapshots 已废弃，响应结构只由 OpenAPI 与生成类型维护");
  }
  const packageDocument = fs.readFileSync(path.resolve(root, "package.json"), "utf8");
  if (packageDocument.includes("snapshots:")) {
    failures.push("package.json 仍包含已废弃的运行时快照命令");
  }
  const foundationLock = JSON.parse(
    fs.readFileSync(path.resolve(root, "foundation.lock.json"), "utf8"),
  ) as { version: string; tag: string };
  const designSystemDocument = fs.readFileSync(
    path.resolve(root, "docs/design-system.md"),
    "utf8",
  );
  for (const versionClaim of [
    `固定到 \`${foundationLock.tag}\``,
    `/blob/${foundationLock.tag}/`,
  ]) {
    if (!designSystemDocument.includes(versionClaim)) {
      failures.push(`docs/design-system.md 未同步 Foundation ${foundationLock.version}`);
    }
  }
  const historicalPlanningPatterns = [
    /本次迭代/,
    /本轮迭代/,
    /本轮补充/,
    /后续迭代/,
    /本次不做/,
    /发布批次/,
    /跨端发布批次/,
    /Phase\s*\d/i,
    /修复记录/,
    /(?:本|原子|第[一二三四五六七八九十0-9]+)切片/,
    /Roadmap/,
    /第一版/,
    /当前无数据/,
    /^##[^\n]*子任务[^\n]*$/m,
    /^\s*- \[[ xX]\]\s+/m,
  ];
  for (const file of currentGuides) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of historicalPlanningPatterns) {
      if (pattern.test(source)) {
        failures.push(
          `${path.relative(root, file)} 混入迭代日志或任务清单：${pattern}`,
        );
      }
    }
  }

  const requiredClaims = new Map<string, string[]>([
    [
      "docs/modules/thread-create.md",
      ["GET /thread-categories", "草稿允许暂不选择分类", "17px / 1.9"],
    ],
    [
      "docs/modules/direct-messages.md",
      ["固定为 72px 图标轨道", "16px / 28px", "分别提供通知和私聊入口"],
    ],
    ["docs/modules/bookmarks.md", ["全局导航栏显示收藏入口"]],
    [
      "docs/modules/markdown-content-protocol.md",
      [
        "markdown-v3-fixtures.json",
        "markdown-v3-nodes-fixtures.json",
        "markdown-editor-roundtrip-v2-fixtures.json",
        "Flutter 必须",
      ],
    ],
    [
      "docs/design-system.md",
      [
        "morenk/wenyousite-foundation",
        "foundation.lock.json",
        "GET /thread-categories",
      ],
    ],
  ]);
  for (const [relativePath, claims] of requiredClaims) {
    const source = fs.readFileSync(path.resolve(root, relativePath), "utf8");
    for (const claim of claims) {
      if (!source.includes(claim)) {
        failures.push(`${relativePath} 缺少当前实现约束：${claim}`);
      }
    }
  }

  const capabilityRow = (ids: Parameters<typeof editorCapabilityLabels>[0]) =>
    editorCapabilityLabels(ids).join("、");
  const editorCapabilityBlock = [
    "<!-- editor-capabilities:start -->",
    "| 层级 | 能力 |",
    "| --- | --- |",
    `| 宽栏一级栏 | ${capabilityRow(EDITOR_PRIMARY_WIDE)} |`,
    `| 最窄核心一级栏 | ${capabilityRow(EDITOR_PRIMARY_NARROW)} |`,
    `| 最窄“更多”基础集合 | ${capabilityRow(EDITOR_MORE_FALLBACK)} |`,
    `| 继续变窄时追加收纳 | ${capabilityRow(EDITOR_MORE_PROGRESSIVE)} |`,
    `| 结构化能力边界 | 仅工具栏入口；白名单外格式静默降为字面文本 |`,
    `| 新建标题层级 | ${[
      "正文",
      ...EDITOR_CREATABLE_HEADING_LEVELS.map((level) => `标题 ${level}`),
    ].join("、")} |`,
    "<!-- editor-capabilities:end -->",
  ].join("\n");
  const protocolDocument = fs.readFileSync(
    path.resolve(root, "docs/modules/markdown-content-protocol.md"),
    "utf8",
  );
  const documentedCapabilityBlock = protocolDocument.match(
    /<!-- editor-capabilities:start -->[\s\S]*?<!-- editor-capabilities:end -->/u,
  )?.[0];
  if (documentedCapabilityBlock !== editorCapabilityBlock) {
    failures.push(
      `编辑器能力表与 src/lib/editor-capabilities.ts 不一致：\n期望\n${editorCapabilityBlock}`,
    );
  }
  if (EDITOR_CAPABILITY_LABELS.more !== "更多") {
    failures.push("编辑器窄栏固定出口必须命名为“更多”");
  }
  if (
    EDITOR_CONTENT_POLICY.markdownContractVersion !== 3 ||
    EDITOR_CONTENT_POLICY.structuredCapabilitySource !== "toolbar" ||
    EDITOR_CONTENT_POLICY.unsupportedClientBehavior !== "literal-text-silent" ||
    EDITOR_CONTENT_POLICY.unsupportedApiBehavior !== "reject" ||
    EDITOR_CONTENT_POLICY.maximumListDepth !== 3
  ) {
    failures.push("Foundation 正文策略必须保持 Markdown v3 工具栏白名单契约");
  }

  const backendRoot = path.resolve(root, "../wenyousite-backend");
  for (const fixtureName of [
    "markdown-v3-fixtures.json",
    "markdown-v3-nodes-fixtures.json",
    "markdown-editor-roundtrip-v2-fixtures.json",
    "thread-category-v1-fixtures.json",
  ]) {
    const frontendFixture = path.resolve(root, "contracts", fixtureName);
    const backendFixture = path.resolve(backendRoot, "contracts", fixtureName);
    if (
      fs.existsSync(backendFixture) &&
      fs.readFileSync(frontendFixture, "utf8") !==
        fs.readFileSync(backendFixture, "utf8")
    ) {
      failures.push(`前后端 ${fixtureName} 不一致`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`文档真实性检查失败：\n${failures.join("\n")}`);
  }
  console.log(
    `Documentation facts match ${allOperations.size} OpenAPI operations and ${directKnownOperations.size} frontend calls`,
  );
}
