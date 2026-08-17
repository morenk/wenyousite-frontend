/** 校验 Web 实际消费的设计基础与显式锁文件一致。 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), "utf8");
const lock = JSON.parse(read("foundation.lock.json"));
const packageJson = JSON.parse(read("package.json"));
const manifest = JSON.parse(read("node_modules/@wenyousite/foundation/foundation-manifest.json"));
const foundationContract = JSON.parse(read("node_modules/@wenyousite/foundation/contracts/foundation.v1.json"));
const openapi = JSON.parse(read("contracts/openapi.json"));
const failures = [];
const repositoryOnlyArtifacts = new Set([
  "packages/flutter/lib/src/foundation_tokens.dart",
  "packages/flutter/lib/src/foundation_formatters.dart",
  "packages/flutter/lib/src/wenyou_icons.dart",
]);

if (packageJson.dependencies?.["@wenyousite/foundation"] !== `github:morenk/wenyousite-foundation#${lock.tag}`) {
  failures.push("package.json 未使用 foundation.lock.json 指定的不可变标签");
}
if (manifest.version !== lock.version) failures.push("已安装 foundation 版本与锁文件不一致");
if (manifest.contractSha256 !== lock.contractSha256) failures.push("已安装 foundation 契约哈希与锁文件不一致");
if (!read("pnpm-lock.yaml").includes(lock.revision)) failures.push("pnpm-lock.yaml 未锁定指定 foundation revision");
if (foundationContract.version !== "6.0.1" || foundationContract.schemaVersion !== 2) {
  failures.push("Web 必须消费 Foundation v6.0.1 schema 2 契约");
}
if (!manifest.features?.typography || !manifest.features?.interaction || !manifest.features?.controls || !manifest.features?.formatting || !manifest.features?.contentPresentation || !manifest.features?.iconControls || !manifest.features?.navigation || !manifest.features?.language || !manifest.features?.elements) {
  failures.push("已安装 Foundation 缺少共享语义能力");
}
if (
  foundationContract.experiences.editor.contentPolicy?.markdownContractVersion !== 3 ||
  foundationContract.experiences.editor.contentPolicy?.structuredCapabilitySource !== "toolbar"
) failures.push("已安装 Foundation 未绑定 Markdown v3 工具栏白名单");
if (Object.keys(manifest.artifactSha256 ?? {}).length !== 29) {
  failures.push("已安装 Foundation 生成产物清单不完整");
}
for (const [relativePath, expectedHash] of Object.entries(manifest.artifactSha256 ?? {})) {
  const installedPath = path.resolve(root, "node_modules/@wenyousite/foundation", relativePath);
  if (!fs.existsSync(installedPath)) {
    if (repositoryOnlyArtifacts.has(relativePath)) continue;
    failures.push(`已安装 Foundation 缺少生成产物 ${relativePath}`);
    continue;
  }
  const actualHash = crypto.createHash("sha256").update(fs.readFileSync(installedPath)).digest("hex");
  if (actualHash !== expectedHash) failures.push(`已安装 Foundation 生成产物哈希不一致 ${relativePath}`);
}
if (manifest.icons?.family !== "Lucide" || manifest.icons?.version !== "1.28.0") {
  failures.push("已安装 Foundation 未提供锁定的 Lucide 图标资产");
}
if (packageJson.dependencies?.["lucide-react"] !== "1.28.0") {
  failures.push("Web Lucide 版本必须与 Foundation SVG 母版一致");
}

const layout = read("src/app/layout.tsx");
if (!layout.includes('@wenyousite/foundation/web/fonts.css')) failures.push("根布局未消费中央字体");
if (!layout.includes('@wenyousite/foundation/web/tokens.css')) failures.push("根布局未消费中央 Token");
const globalStyles = read("src/app/globals.css");
if (/^:root\s*\{/mu.test(globalStyles)) failures.push("globals.css 不得复制中央 :root Token");
for (const claim of ["--type-body-size", "--type-body-line-height"]) {
  if (!globalStyles.includes(`var(${claim})`)) failures.push(`globals.css 未消费语义排版 Token ${claim}`);
}
const foundationTokens = read("node_modules/@wenyousite/foundation/web/tokens.css");
for (const token of ["--type-page-title-size", "--overlay-scrim", "--layer-modal", "--layer-global-progress", "--like", "--bookmark", "--icon-control-state-layer-color", "--icon-control-state-layer-radius", "--icon-control-hover-state-opacity", "--icon-control-focus-state-opacity", "--icon-control-pressed-state-opacity", "--icon-control-disabled-content-opacity", "--element-internal-reference-surface", "--element-badge-default-height", "--element-level-mist-surface", "--element-level-berry-surface"]) {
  if (!foundationTokens.includes(`${token}:`)) failures.push(`Foundation Web Token 缺少 ${token}`);
}
if (
  foundationContract.experiences.elements?.inline?.internalReference?.icon !== "content.internal-reference"
  || foundationContract.experiences.elements?.metadata?.unreadCount?.maximumDisplay !== "99+"
  || foundationContract.experiences.elements?.metadata?.categoryMarker?.colorOwner !== "foundation"
  || foundationContract.experiences.elements?.identity?.emailVerification?.publicIdentity !== "hidden"
  || foundationContract.experiences.elements?.inline?.dice?.labels?.visibleResult !== "total-only"
  || foundationContract.experiences.elements?.inline?.dice?.data?.resultSource !== "server-only"
) {
  failures.push("Foundation 缺少核心正文与元数据元素语义");
}
if (
  foundationContract.experiences.icons.controls?.selected?.like?.semanticId !== "action.like"
  || foundationContract.experiences.icons.controls?.selected?.bookmark?.semanticId !== "action.bookmark"
  || foundationContract.experiences.icons.controls?.selected?.subscription?.semanticId !== "action.subscribe"
  || foundationContract.experiences.icons.controls?.selected?.like?.surface !== "transparent"
  || foundationContract.experiences.icons.controls?.selected?.bookmark?.surface !== "transparent"
  || foundationContract.experiences.icons.controls?.selected?.subscription?.surface !== "transparent"
) {
  failures.push("Foundation 缺少透明底的点赞、收藏与订阅互动控件语义");
}
for (const schemaName of [
  "ThreadCategoryResponseDto",
  "CreateThreadCategoryDto",
  "UpdateThreadCategoryDto",
]) {
  if ("color" in (openapi.components.schemas[schemaName]?.properties ?? {})) {
    failures.push(`${schemaName} 不得重新引入分类颜色字段`);
  }
}

const iconAdapter = read("src/components/ui/wenyou-icon.tsx");
if (
  !iconAdapter.includes('@wenyousite/foundation/icons')
  || !iconAdapter.includes("IconVisualVariant")
  || !iconAdapter.includes("data-icon-semantic")
  || !iconAdapter.includes("data-icon-variant")
) {
  failures.push("Web 核心图标未通过 Foundation 语义适配器渲染");
}
const editorHost = read("src/components/editor/milkdown-editor-host.tsx");
if (!editorHost.includes("editorIconSvg") || /const\s+(?:DRAFT|DICE|MORE)_ICON/.test(editorHost)) {
  failures.push("Milkdown 工具栏必须使用 Foundation 同源 SVG，禁止保留手写图标");
}
const editorStyles = read("src/components/editor/milkdown-editor.css");
if (!/svg\.lucide\s*\{[^}]*fill:\s*none;[^}]*stroke:\s*currentColor;/su.test(editorStyles)) {
  failures.push("Milkdown 必须覆盖 Crepe 的实心 fill，保持 Foundation Lucide 无填充描边");
}

const foundationNotificationTypes = foundationContract.experiences.notifications.groups
  .flatMap((group) => group.types)
  .sort();
const apiNotificationTypes = [...new Set(
  openapi.components.schemas.NotificationResponseDto.properties.type.enum.map((type) =>
    type === "new_floor" || type === "subthread_created" ? "new_post" : type,
  ),
)].sort();
if (JSON.stringify(foundationNotificationTypes) !== JSON.stringify(apiNotificationTypes)) {
  failures.push("Foundation 通知分组未完整且唯一覆盖后端规范通知类型");
}
const notificationFilters = read("src/lib/notification-filters.ts");
if (!notificationFilters.includes('@wenyousite/foundation/notifications')) {
  failures.push("通知筛选必须直接消费 Foundation 分组契约");
}

for (const [fileName, moduleName] of [
  ["src/components/layout/nav-bar.tsx", "@wenyousite/foundation/navigation"],
  ["src/components/shared/loading-state.tsx", "@wenyousite/foundation/interaction"],
  ["src/components/shared/load-error.tsx", "@wenyousite/foundation/language"],
  ["src/components/ui/badge.tsx", "@wenyousite/foundation/elements"],
  ["src/components/shared/internal-reference-link.tsx", "@wenyousite/foundation/elements"],
  ["src/components/ui/unread-count-badge.tsx", "@wenyousite/foundation/elements"],
  ["src/components/ui/button.tsx", "@wenyousite/foundation/controls"],
  ["src/components/ui/input.tsx", "@wenyousite/foundation/controls"],
  ["src/components/ui/skeleton.tsx", "@wenyousite/foundation/interaction"],
  ["src/components/shared/wenyou-time.tsx", "@wenyousite/foundation/formatting"],
  ["src/components/shared/wenyou-count.tsx", "@wenyousite/foundation/formatting"],
  ["src/components/shared/level-badge.tsx", "@wenyousite/foundation/elements"],
  ["src/components/shared/user-avatar.tsx", "@wenyousite/foundation/elements"],
  ["src/lib/dice-inline.ts", "@wenyousite/foundation/elements"],
  ["src/components/thread/thread-card.tsx", "@wenyousite/foundation/collections"],
  ["src/components/thread/thread-detail-header.tsx", "@wenyousite/foundation/collections"],
  ["src/components/moment/moment-card.tsx", "@wenyousite/foundation/collections"],
  ["src/components/moment/moment-detail-view.tsx", "@wenyousite/foundation/collections"],
]) {
  if (!read(fileName).includes(moduleName)) failures.push(`${fileName} 未直接消费 ${moduleName}`);
}

if (failures.length > 0) throw new Error(`Foundation 锁定检查失败：\n${failures.join("\n")}`);
console.log(`Web consumes wenyousite-foundation ${lock.version} (${lock.revision.slice(0, 7)})`);
