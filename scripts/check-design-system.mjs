/** 设计系统静态门禁：阻止业务 UI 绕过语义 Token 与共享控件。 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = process.cwd();
const sourceRoots = [
  resolve(root, "src/app"),
  resolve(root, "src/components"),
];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(file);
    }
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [file] : [];
  });
}

const sharedRules = [
  {
    label: "业务 UI 不得写十六进制或 rgb 色值，请使用 globals.css 语义 Token",
    pattern: /(?:#[0-9a-f]{3,8}\b|rgba?\s*\()/i,
  },
  {
    label: "业务表单不得使用原生 select，请复用 components/ui/select",
    pattern: /<select(?:\s|>)/,
  },
  {
    label: "业务 UI 不得声明任意阴影，请使用 shadow-popover/dialog/floating",
    pattern: /shadow-\[/,
  },
  {
    label: "业务 UI 不得声明全局数字 z-index，请使用 Foundation layer Token",
    pattern: /(?:\bz-(?:30|40|50)\b|z-\[\d+\])/,
  },
  {
    label: "普通模态遮罩必须使用 Foundation overlay scrim Token",
    pattern: /bg-foreground\/(?:40|45).*backdrop-blur-\[1px\]/,
  },
  {
    label: "业务 Tab 不得手写 ARIA 状态机，请复用 components/ui/tabs",
    pattern: /role=["']tablist["']/,
  },
  {
    label: "方向状态必须显式匹配 data-orientation，请使用 data-[orientation=...] 变体",
    pattern: /(?:group-)?data-(?:horizontal|vertical)(?:\/[\w-]+)?:/,
  },
  {
    label: "密码字段必须复用 PasswordInput",
    pattern: /type=["']password["']/,
  },
  {
    label: "登录返回地址必须通过 useLoginRedirect/buildLoginHref 生成",
    pattern: /\/login\?next=/,
  },
  {
    label: "动态模块不得建立“温油便笺”第二品牌文案",
    pattern: /温油便笺/,
  },
];

const failures = [];
for (const file of sourceRoots.flatMap(sourceFiles)) {
  const source = readFileSync(file, "utf8");
  const fileName = relative(root, file);
  for (const rule of sharedRules) {
    const match = rule.pattern.exec(source);
    if (!match) continue;
    const line = source.slice(0, match.index).split("\n").length;
    failures.push(`${fileName}:${line}: ${rule.label}`);
  }

  const rawReplyIcon = /import\s*\{[^}]*\bReply\b[^}]*\}\s*from\s*["']lucide-react["']/s.exec(source);
  if (rawReplyIcon) {
    const line = source.slice(0, rawReplyIcon.index).split("\n").length;
    failures.push(`${fileName}:${line}: 回复动作必须通过 ReplyActionButton 使用 Foundation action.reply 语义`);
  }

  if (
    fileName.startsWith("src/app/")
    && fileName.endsWith("/page.tsx")
    && /max-w-\[/.test(source)
  ) {
    failures.push(
      `${fileName}: 页面不得直接声明任意 max-width，请为 PageShell 增加语义宽度`,
    );
  }

  if (source.includes("formatDistanceToNow")) {
    failures.push(`${fileName}: 列表与详情时间必须通过 WenyouTime 消费 Foundation 72 小时窗口`);
  }
}

const bodyTypographyFiles = [
  "src/components/ui/card.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/shared/user-avatar.tsx",
  "src/components/thread/thread-card.tsx",
  "src/components/thread/subthread-tabs.tsx",
  "src/components/thread/thread-reading-bar.tsx",
  "src/components/thread/thread-detail-more.tsx",
  "src/components/user/bookmark-thread-card.tsx",
  "src/components/user/draft-list.tsx",
  "src/components/user/user-activity-summary.tsx",
  "src/components/user/user-profile-card.tsx",
  "src/components/layout/publish-menu.tsx",
  "src/components/layout/app-context-rail.tsx",
  "src/components/admin/high-risk-gate.tsx",
  "src/app/not-found.tsx",
  "src/app/error.tsx",
  "src/app/moments/page.tsx",
];
for (const fileName of bodyTypographyFiles) {
  if (readFileSync(resolve(root, fileName), "utf8").includes("font-display")) {
    failures.push(`${fileName}: 列表、弹层、状态、控件、用户名或数字不得使用文楷`);
  }
}

const governedIconFiles = [
  "src/components/shared/empty-state.tsx",
  "src/components/shared/load-error.tsx",
  "src/components/shared/loading-state.tsx",
  "src/components/editor/editor-more-menu.tsx",
  "src/components/editor/milkdown-editor-core.tsx",
  "src/components/layout/nav-bar.tsx",
  "src/components/layout/page-header.tsx",
  "src/components/layout/publish-menu.tsx",
  "src/components/ui/dialog.tsx",
];
for (const fileName of governedIconFiles) {
  const source = readFileSync(resolve(root, fileName), "utf8");
  if (source.includes('from "lucide-react"')) {
    failures.push(`${fileName}: 核心导航与编辑器图标必须通过 WenyouIcon 使用 Foundation 语义`);
  }
}

const semanticContractClaims = new Map([
  ["src/app/globals.css", [
    "var(--type-body-size)",
    "var(--type-body-line-height)",
    "var(--icon-control-hover-state-opacity)",
    "var(--icon-control-focus-state-opacity)",
    "var(--icon-control-pressed-state-opacity)",
    "var(--icon-control-state-layer-radius)",
    "var(--element-internal-reference-surface)",
    "var(--element-code-surface)",
    "var(--element-quote-padding-block)",
  ]],
  ["src/components/ui/badge.tsx", ["@wenyousite/foundation/elements", "BadgeSize", "--element-badge-compact-height"]],
  ["src/components/ui/unread-count-badge.tsx", ["@wenyousite/foundation/elements", "maximumDisplay", "data-slot=\"unread-count\""]],
  ["src/components/ui/content-link.tsx", ["@wenyousite/foundation/elements", "data-slot", "externalBehavior"]],
  ["src/components/shared/internal-reference-link.tsx", ["@wenyousite/foundation/elements", "internalReference.icon", "internal-reference-element"]],
  ["src/components/shared/internal-reference-editor-dom.ts", ["@wenyousite/foundation/elements", "iconNode", "editorBehavior"]],
  ["src/components/shared/level-badge.tsx", ["@wenyousite/foundation/elements", "--element-level-height", "data-slot=\"level-badge\"", "levelTier", "data-level-tier", "--element-level-${tier.id}-surface"]],
  ["src/components/shared/user-avatar.tsx", ["IDENTITY_PRESENTATION", "onError", "avatarFallback.missingOrFailed"]],
  ["src/components/shared/wenyou-time.tsx", ["@wenyousite/foundation/formatting", "formatWenyouTime", "formatWenyouExactTime", "title="]],
  ["src/components/shared/wenyou-count.tsx", ["@wenyousite/foundation/formatting", "formatWenyouCompactCount", "aria-label"]],
  ["src/components/ui/button.tsx", ["@wenyousite/foundation/controls", "data-control-role", "pendingLabel", 'id="status.loading"', "aria-busy"]],
  ["src/components/ui/input.tsx", ["@wenyousite/foundation/controls", "data-control-state"]],
  ["src/components/ui/form-field.tsx", ["data-slot=\"form-field\"", "aria-describedby", "aria-invalid", "labelAction"]],
  ["src/components/ui/password-input.tsx", ['id={show ? "action.hide" : "action.show"}', "cn(\"pr-11\", className)"]],
  ["src/components/ui/skeleton.tsx", ["MOTION_USAGE", "motion-reduce:animate-none"]],
  ["src/lib/dice-inline.ts", ["INLINE_ELEMENT_STYLES", "labels.settled", "semantics.settled"]],
  ["src/app/globals.css", ["white-space: nowrap", "vertical-align: baseline"]],
  ["src/components/thread/thread-card.tsx", ["CONTENT_PRESENTATION.list", "data-content-purpose"]],
  ["src/components/thread/thread-detail-header.tsx", ["CONTENT_PRESENTATION.detail", "data-content-purpose"]],
  ["src/components/moment/moment-card.tsx", ["CONTENT_PRESENTATION.list", "data-content-purpose"]],
  ["src/components/moment/moment-detail-view.tsx", ["CONTENT_PRESENTATION.detail", "data-content-purpose"]],
  ["src/components/thread/topic-tag-link.tsx", ["@wenyousite/foundation/elements", "--element-topic-tag-min-height", "data-slot=\"topic-tag\""]],
  ["src/components/thread/thread-category.tsx", ["data-slot=\"category-badge\""]],
  ["src/lib/thread-presentation.ts", ["METADATA_ELEMENT_STYLES", "categoryMarker.badgeTone"]],
  ["src/components/layout/page-header.tsx", ["--type-page-title-size", "--type-section-title-size"]],
  ["src/components/ui/dialog.tsx", ["--type-subsection-title-size", "--layer-modal-backdrop", "--overlay-scrim"]],
  ["src/components/ui/tooltip.tsx", ["--layer-tooltip"]],
  ["src/components/ui/select.tsx", ["--layer-popup"]],
  ["src/components/shared/floating-input-dock.tsx", ["--layer-floating"]],
  ["src/components/layout/nav-bar.tsx", ["@wenyousite/foundation/navigation", "--layer-chrome"]],
  ["src/components/layout/navigation-progress.tsx", ["--layer-global-progress"]],
  ["src/components/editor/editor-more-menu.tsx", ["--layer-nested-popup"]],
  ["src/components/shared/loading-state.tsx", ["@wenyousite/foundation/interaction", "data-feedback-state"]],
  ["src/components/shared/load-error.tsx", ["@wenyousite/foundation/language", "data-feedback-state"]],
  ["src/components/shared/empty-state.tsx", ["@wenyousite/foundation/interaction", "data-feedback-state"]],
  ["src/components/ui/interaction-toggle.tsx", [
    "@wenyousite/foundation/icons",
    "IconControlTone",
    "IconVisualVariant",
    "ICON_CONTROL_STATES",
    "aria-pressed={pressed}",
    "aria-busy={pending || undefined}",
    "selectedIconVariants",
    'state.glyph === "filled"',
    'subscription: "text-brand-strong"',
    'data-slot="interaction-toggle-icon-target"',
    'pending ? "status.loading" : icon',
  ]],
  ["src/components/thread/thread-detail-header.tsx", [
    "InteractionToggle",
    'tone="like"',
    'accessibleName="点赞"',
    "accessibleDescription",
  ]],
  ["src/components/moment/moment-card.tsx", [
    "InteractionToggle",
    'tone="like"',
    'accessibleName="点赞"',
    "accessibleDescription",
  ]],
  ["src/components/moment/moment-detail-view.tsx", [
    "InteractionToggle",
    'tone="like"',
    'tone="bookmark"',
    'accessibleName="点赞"',
    'accessibleName="收藏"',
  ]],
  ["src/components/user/bookmark-button.tsx", [
    "InteractionToggle",
    'tone="bookmark"',
    'accessibleName="收藏"',
  ]],
  ["src/components/thread/thread-subscription-controls.tsx", [
    "InteractionToggle",
    'tone="subscription"',
    'icon="action.subscribe"',
    'accessibleName="订阅官方更新"',
    "accessibleDescription",
  ]],
  ["src/components/shared/reply-action-button.tsx", [
    "Tooltip",
    "id=\"action.reply\"",
    "aria-label={presentation === \"icon\" ? label : undefined}",
    "presentation === \"labeled\"",
    "<span>{label}</span>",
  ]],
  ["src/components/thread/floor-card.tsx", ["ReplyActionButton"]],
  ["src/components/thread/reply-card.tsx", ["ReplyActionButton"]],
  ["src/components/moment/moment-comment-row.tsx", ["ReplyActionButton"]],
  ["src/components/thread/thread-composer-entry.tsx", ["WenyouIcon", "id={iconId}"]],
  ["src/components/thread/reply-form.tsx", ["ThreadComposerEntry", "iconId=\"action.reply\""]],
  ["src/components/thread/floor-form.tsx", ["ThreadComposerEntry", "iconId=\"action.add-comment\""]],
]);
for (const [fileName, claims] of semanticContractClaims) {
  const source = readFileSync(resolve(root, fileName), "utf8");
  for (const claim of claims) {
    if (!source.includes(claim)) failures.push(`${fileName}: 未消费当前 Foundation 语义（缺少 ${claim}）`);
  }
}

const interactionToggleSource = readFileSync(
  resolve(root, "src/components/ui/interaction-toggle.tsx"),
  "utf8",
);
for (const forbiddenSurface of ["bg-accent", "bg-like-soft", "bg-bookmark-soft"]) {
  if (interactionToggleSource.includes(forbiddenSurface)) {
    failures.push(`InteractionToggle 选中态不得渲染常驻背景（发现 ${forbiddenSurface}）`);
  }
}

const stickerDisplayClaims = new Map([
  ["node_modules/@wenyousite/foundation/web/tokens.css", ["--sticker-display-max: 8rem"]],
  ["src/app/globals.css", ["img.sticker-display"]],
  ["src/components/editor/milkdown-editor.css", ["var(--sticker-display-max)"]],
  ["src/components/thread/markdown-content.tsx", ["sticker-display", "STICKER_DISPLAY_STYLE"]],
  ["src/components/moment/moment-comment-row.tsx", ["sticker-display", "getStickerDisplayUrl"]],
  ["src/components/message/direct-message-bubble.tsx", ["sticker-display", "getStickerDisplayUrl"]],
]);
for (const [fileName, claims] of stickerDisplayClaims) {
  const source = readFileSync(resolve(root, fileName), "utf8");
  for (const claim of claims) {
    if (!source.includes(claim)) {
      failures.push(`${fileName}: 表情展示必须复用统一 128px Token 与静态缩略图策略（缺少 ${claim}）`);
    }
  }
}

const fullWidthCollectionClaims = new Map([
  ["src/components/ui/stack-list.tsx", ["w-full divide-y"]],
  ["src/components/ui/tabs.tsx", ["w-full flex-col", "group-data-[orientation=horizontal]/tabs:w-full"]],
  ["src/components/search/search-results.tsx", ["relative w-full min-w-0", "block w-full", "flex w-full"]],
  ["src/components/search/post-search-result-list.tsx", ["w-full space-y-3", "block w-full"]],
  ["src/components/moment/moment-masonry.tsx", ["className=\"w-full\""]],
  ["src/components/user/bookmark-list.tsx", ["w-full space-y-3"]],
  ["src/components/user/draft-list.tsx", ["w-full space-y-3", "flex w-full"]],
  ["src/components/user/user-follow-list.tsx", ["w-full space-y-3", "flex w-full"]],
  ["src/components/notification/notification-list.tsx", ["w-full space-y-3"]],
  ["src/components/message/direct-conversation-list.tsx", ["flex w-full gap-3", "min-h-0 w-full flex-col"]],
]);
for (const [fileName, claims] of fullWidthCollectionClaims) {
  const source = readFileSync(resolve(root, fileName), "utf8");
  for (const claim of claims) {
    if (!source.includes(claim)) {
      failures.push(`${fileName}: 集合容器与列表项必须占满分配列（缺少 ${claim}）`);
    }
  }
}

const elementDuplicateBans = new Map([
  ["src/components/shared/internal-reference-link.tsx", ["from \"lucide-react\"", "bg-primary/10", "rounded-[0.4em]"]],
  ["src/components/shared/internal-reference-editor-dom.ts", ["M13 4h3", "M13 4.562"]],
  ["src/components/message/message-center-tabs.tsx", ["function CountBadge", "count > 99", "bg-destructive"]],
  ["src/components/message/direct-conversation-list.tsx", ["count > 99", "bg-destructive"]],
  ["src/components/layout/nav-bar.tsx", ["count > 99", "bg-destructive"]],
  ["src/components/layout/app-context-rail.tsx", ["count > 99", "bg-destructive"]],
  ["src/components/shared/level-badge.tsx", ["0.6875rem", "min-h-5"]],
  ["src/components/thread/topic-tag-link.tsx", ["min-h-6"]],
  ["src/lib/thread-presentation.ts", ["--category-color", "normalizeCategoryColor", "definition?.color", "${color}1F", "${color}55"]],
  ["src/components/thread/thread-category.tsx", ["data-has-category-color", "badgeStyle", "markerStyle"]],
  ["src/components/admin/category-edit-dialog.tsx", ["category.color", "register(\"color\")", "values.color", "previewColor"]],
  ["src/components/admin/taxonomy-panel.tsx", ["categoryColor", "category.color"]],
  ["src/lib/admin-url-state.ts", ["categoryColor"]],
  ["src/app/globals.css", ["--category-color", "data-has-category-color", "category-badge-tint-opacity", "category-badge-border-opacity"]],
]);
for (const [fileName, banned] of elementDuplicateBans) {
  const source = readFileSync(resolve(root, fileName), "utf8");
  for (const claim of banned) {
    if (source.includes(claim)) failures.push(`${fileName}: 核心元素样式不得保留重复实现（${claim}）`);
  }
}

if (failures.length > 0) {
  throw new Error(`设计系统静态检查失败：\n${failures.join("\n")}`);
}

console.log("Design tokens, elements, icon controls, typography, feedback, layers, navigation, semantic widths, and shadows follow Foundation");
