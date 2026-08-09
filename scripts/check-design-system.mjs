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
    label: "业务 Tab 不得手写 ARIA 状态机，请复用 components/ui/tabs",
    pattern: /role=["']tablist["']/,
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

if (failures.length > 0) {
  throw new Error(`设计系统静态检查失败：\n${failures.join("\n")}`);
}

console.log("Design tokens, shared selects/tabs, semantic widths, and shadow roles follow the design system");
