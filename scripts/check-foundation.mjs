/** 校验 Web 实际消费的设计基础与显式锁文件一致。 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), "utf8");
const sha256 = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
const lock = JSON.parse(read("foundation.lock.json"));
const packageJson = JSON.parse(read("package.json"));
const manifest = JSON.parse(read("node_modules/@wenyousite/foundation/foundation-manifest.json"));
const foundationContract = JSON.parse(read("node_modules/@wenyousite/foundation/contracts/foundation.v1.json"));
const openapi = JSON.parse(read("contracts/openapi.json"));
const failures = [];
const repositoryOnlyArtifacts = new Set([
  "packages/flutter/lib/src/foundation_tokens.dart",
  "packages/flutter/lib/src/foundation_formatters.dart",
  "packages/flutter/lib/src/foundation_brand.dart",
  "packages/flutter/lib/src/wenyou_icons.dart",
]);

if (packageJson.dependencies?.["@wenyousite/foundation"] !== `github:morenk/wenyousite-foundation#${lock.tag}`) {
  failures.push("package.json 未使用 foundation.lock.json 指定的不可变标签");
}
if (manifest.version !== lock.version) failures.push("已安装 foundation 版本与锁文件不一致");
if (manifest.contractSha256 !== lock.contractSha256) failures.push("已安装 foundation 契约哈希与锁文件不一致");
if (!read("pnpm-lock.yaml").includes(lock.revision)) failures.push("pnpm-lock.yaml 未锁定指定 foundation revision");
if (foundationContract.version !== "6.5.1" || foundationContract.schemaVersion !== 2) {
  failures.push("Web 必须消费 Foundation v6.5.1 schema 2 契约");
}
if (!manifest.features?.themes || !manifest.features?.typography || !manifest.features?.interaction || !manifest.features?.controls || !manifest.features?.formatting || !manifest.features?.contentPresentation || !manifest.features?.iconControls || !manifest.features?.navigation || !manifest.features?.language || !manifest.features?.elements || !manifest.features?.brand) {
  failures.push("已安装 Foundation 缺少共享语义能力");
}
if (
  foundationContract.experiences.editor.contentPolicy?.markdownContractVersion !== 3 ||
  foundationContract.experiences.editor.contentPolicy?.structuredCapabilitySource !== "toolbar"
) failures.push("已安装 Foundation 未绑定 Markdown v3 工具栏白名单");
if (Object.keys(manifest.artifactSha256 ?? {}).length !== 60) {
  failures.push("已安装 Foundation 生成产物清单不完整");
}
for (const [relativePath, expectedHash] of Object.entries(manifest.artifactSha256 ?? {})) {
  const installedPath = path.resolve(root, "node_modules/@wenyousite/foundation", relativePath);
  if (!fs.existsSync(installedPath)) {
    if (repositoryOnlyArtifacts.has(relativePath) || relativePath.startsWith("packages/flutter/brand_assets/")) continue;
    failures.push(`已安装 Foundation 缺少生成产物 ${relativePath}`);
    continue;
  }
  const actualHash = sha256(installedPath);
  if (actualHash !== expectedHash) failures.push(`已安装 Foundation 生成产物哈希不一致 ${relativePath}`);
}
if (manifest.icons?.family !== "Lucide" || manifest.icons?.version !== "1.28.0") {
  failures.push("已安装 Foundation 未提供锁定的 Lucide 图标资产");
}
if (packageJson.dependencies?.["lucide-react"] !== "1.28.0") {
  failures.push("Web Lucide 版本必须与 Foundation SVG 母版一致");
}

const layout = read("src/app/layout.tsx");
const themeBootstrap = read("src/lib/theme-bootstrap.ts");
if (!layout.includes('@wenyousite/foundation/web/fonts.css')) failures.push("根布局未消费中央字体");
if (!layout.includes('@wenyousite/foundation/web/tokens.css')) failures.push("根布局未消费中央 Token");
if (!layout.includes('@wenyousite/foundation/brand') || !layout.includes("BRAND_NAME") || !layout.includes("BRAND_TAGLINE")) {
  failures.push("根布局未消费 Foundation 正式品牌文案");
}
if (!themeBootstrap.includes('@wenyousite/foundation/theme') || !layout.includes("THEME_BOOTSTRAP_SCRIPT") || !layout.includes("suppressHydrationWarning")) {
  failures.push("根布局未在 hydration 前消费 Foundation 主题契约");
}
for (const metadataClaim of ["/site.webmanifest", "/favicon.ico", "/apple-touch-icon.png"]) {
  if (!layout.includes(metadataClaim)) failures.push(`根布局元数据缺少 ${metadataClaim}`);
}

const webBrandAssetTargets = new Map([
  ["brand/ui/title-icon-128.png", "public/brand-title-icon-128.png"],
  ["brand/web/favicon.ico", "src/app/favicon.ico"],
  ["brand/web/favicon-16x16.png", "public/favicon-16x16.png"],
  ["brand/web/favicon-32x32.png", "public/favicon-32x32.png"],
  ["brand/web/favicon-48x48.png", "public/favicon-48x48.png"],
  ["brand/web/apple-touch-icon.png", "public/apple-touch-icon.png"],
  ["brand/web/pwa-icon-192.png", "public/pwa-icon-192.png"],
  ["brand/web/pwa-icon-512.png", "public/pwa-icon-512.png"],
  ["brand/web/pwa-icon-1024.png", "public/pwa-icon-1024.png"],
  ["brand/web/pwa-icon-maskable-512.png", "public/pwa-icon-maskable-512.png"],
  ["brand/web/site.webmanifest", "public/site.webmanifest"],
]);
if (manifest.brand?.name !== "温油站" || manifest.brand?.tagline !== "最温油的文字共创社区") {
  failures.push("已安装 Foundation 缺少正式品牌身份");
}
for (const [sourcePath, targetPath] of webBrandAssetTargets) {
  const expectedHash = manifest.brand?.assets?.[sourcePath];
  const installedPath = path.resolve(root, "node_modules/@wenyousite/foundation", sourcePath);
  const target = path.resolve(root, targetPath);
  if (!expectedHash) {
    failures.push(`Foundation 品牌清单缺少 ${sourcePath}`);
    continue;
  }
  if (!fs.existsSync(installedPath) || sha256(installedPath) !== expectedHash) {
    failures.push(`已安装 Foundation 品牌资源哈希不一致 ${sourcePath}`);
  }
  if (!fs.existsSync(target) || sha256(target) !== expectedHash) {
    failures.push(`Web 品牌资源未同步 ${targetPath}`);
  }
}
const globalStyles = read("src/app/globals.css");
const navBar = read("src/components/layout/nav-bar.tsx");
if (!navBar.includes('@wenyousite/foundation/brand') || !navBar.includes("BrandTitleMark") || !navBar.includes("ThemeMenu")) {
  failures.push("全局导航未消费 Foundation 标题品牌标识");
}
const brandTitleMark = read("src/components/ui/brand-title-mark.tsx");
if (!brandTitleMark.includes("/brand-title-icon-128.png") || !globalStyles.includes("brand-title-mark-dark")) {
  failures.push("标题品牌标识缺少黑夜可读映射");
}
const authPageShell = read("src/components/auth/auth-page-shell.tsx");
if (
  !authPageShell.includes('@wenyousite/foundation/brand')
  || !authPageShell.includes("BRAND_TAGLINE")
  || !authPageShell.includes("BrandTitleMark")
  || authPageShell.includes("bg-primary")
) {
  failures.push("认证页面未消费无背景的 Foundation 品牌标识与正式文案");
}
if (/^:root\s*\{/mu.test(globalStyles)) failures.push("globals.css 不得复制中央 :root Token");
for (const claim of ["--type-body-size", "--type-body-line-height"]) {
  if (!globalStyles.includes(`var(${claim})`)) failures.push(`globals.css 未消费语义排版 Token ${claim}`);
}
const foundationTokens = read("node_modules/@wenyousite/foundation/web/tokens.css");
for (const token of ["--action-primary", "--action-primary-foreground", "--image-viewer-backdrop", "--type-page-title-size", "--overlay-scrim", "--layer-modal", "--layer-global-progress", "--like", "--bookmark", "--icon-control-state-layer-color", "--icon-control-state-layer-radius", "--icon-control-hover-state-opacity", "--icon-control-focus-state-opacity", "--icon-control-pressed-state-opacity", "--icon-control-disabled-content-opacity", "--element-internal-reference-surface", "--element-badge-default-height", "--element-level-mist-surface", "--element-level-berry-surface", "--element-quote-foreground", "--element-quote-surface", "--element-quote-marker", "--element-quote-marker-width", "--element-quote-radius", "--element-quote-font-weight", "--element-quote-padding-block", "--element-quote-padding-inline"]) {
  if (!foundationTokens.includes(`${token}:`)) failures.push(`Foundation Web Token 缺少 ${token}`);
}
if (!foundationTokens.includes('[data-theme="dark"]') || !foundationTokens.includes("prefers-color-scheme: dark")) {
  failures.push("Foundation Web Token 缺少显式黑夜模式或系统偏好回退");
}
if (
  foundationContract.themes?.defaultPreference !== "system"
  || foundationContract.themes?.preferences?.join(",") !== "system,light,dark"
  || foundationContract.themes?.icons?.dark !== "appearance.dark"
) {
  failures.push("Foundation 缺少稳定的系统、亮色与黑夜偏好契约");
}
const themeRuntime = read("src/lib/theme.ts");
const themeProvider = read("src/components/ui/theme-provider.tsx");
const themeMenu = read("src/components/layout/theme-menu.tsx");
if (
  !themeRuntime.includes('@wenyousite/foundation/theme')
  || !themeRuntime.includes('THEME_STORAGE_KEY = "wenyousite-theme"')
  || !themeProvider.includes("syncThemeDocument")
  || !themeProvider.includes('window.addEventListener("storage"')
  || !themeMenu.includes("THEME_PREFERENCES")
  || !themeMenu.includes('type="radio"')
) {
  failures.push("Web 主题运行时未完整消费中央偏好、持久化与可访问选择器");
}
const quoteContract = foundationContract.experiences.elements?.block?.quote;
if (JSON.stringify(quoteContract) !== JSON.stringify({
  foreground: "foreground",
  surface: "muted",
  marker: "brandStrong",
  markerWidthPx: 2,
  radius: "compact",
  radiusApplication: "trailing-only",
  width: "available",
  fontFamily: "body",
  fontSize: "inherit",
  lineHeight: "inherit",
  fontWeight: 400,
  fontStyle: "normal",
  paddingBlockEm: 0.5,
  paddingInlineEm: 0.75,
  outerSpacing: "native-block-rhythm",
  contentSpacing: "trim-outer-preserve-inner",
  generatedAdornment: "none",
  shadow: "none",
})) {
  failures.push("Foundation 缺少统一的书签纸条引用契约");
}
if (
  foundationContract.experiences.elements?.inline?.internalReference?.icon !== "content.internal-reference"
  || foundationContract.experiences.elements?.metadata?.unreadCount?.maximumDisplay !== "99+"
  || foundationContract.experiences.elements?.metadata?.categoryMarker?.colorOwner !== "foundation"
  || foundationContract.experiences.elements?.identity?.emailVerification?.publicIdentity !== "hidden"
  || foundationContract.experiences.elements?.inline?.dice?.labels?.visibleResult !== "total-only"
  || foundationContract.experiences.elements?.inline?.dice?.labels?.resultBreakdown !== "interactive-detail"
  || foundationContract.experiences.elements?.inline?.dice?.data?.resultSource !== "server-only"
  || foundationContract.experiences.elements?.web?.dice?.detailSurface !== "anchored-popover"
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
