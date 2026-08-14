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

  if (
    fileName.startsWith("src/app/")
    && fileName.endsWith("/page.tsx")
    && /max-w-\[/.test(source)
  ) {
    failures.push(
      `${fileName}: 页面不得直接声明任意 max-width，请为 PageShell 增加语义宽度`,
    );
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
  ["src/app/globals.css", ["var(--type-body-size)", "var(--type-body-line-height)"]],
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
]);
for (const [fileName, claims] of semanticContractClaims) {
  const source = readFileSync(resolve(root, fileName), "utf8");
  for (const claim of claims) {
    if (!source.includes(claim)) failures.push(`${fileName}: 未消费 Foundation v2.2 语义（缺少 ${claim}）`);
  }
}

const stickerDisplayClaims = new Map([
  ["node_modules/@wenyousite/foundation/web/tokens.css", ["--sticker-display-max: 8rem"]],
  ["src/app/globals.css", ["img.sticker-display"]],
  ["src/components/editor/milkdown-editor.css", ["var(--sticker-display-max)"]],
  ["src/components/thread/markdown-content.tsx", ["sticker-display", "STICKER_DISPLAY_STYLE"]],
  ["src/components/moment/moment-comments.tsx", ["sticker-display", "getStickerDisplayUrl"]],
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
  ["src/components/user/user-thread-list.tsx", ["w-full space-y-3", "block w-full"]],
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

if (failures.length > 0) {
  throw new Error(`设计系统静态检查失败：\n${failures.join("\n")}`);
}

console.log("Design tokens, typography, feedback, layers, navigation, semantic widths, and shadows follow Foundation");
