/** 系统字体门禁：源码、生产应用产物不得重新引入自有字体。 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, basename } from "node:path";
import { pathToFileURL } from "node:url";

export const retiredFontPattern = /\bnoto(?=[\s"'_,.-]|$)|lxgw|wenkai|nunito|fonts\.css/i;
export const fontExtensionPattern = /\.(?:woff2?|ttf|otf|eot)(?:[?#]|$)/i;
// 数学/图标字体是功能资源；不将它们误判为界面字体。哈希文件名仍保留家族前缀。
export const functionalFontPattern = /^(?:KaTeX_[\w-]+|Material(?:Icons|Symbols)[\w-]*)(?:\.[\w-]+)?\.(?:woff2?|ttf|otf|eot)$/i;

export function fontViolations(name, content = "") {
  const failures = [];
  if (retiredFontPattern.test(name) || retiredFontPattern.test(content)) failures.push("旧字体名称或 fonts.css 入口");
  if (fontExtensionPattern.test(name) && !functionalFontPattern.test(basename(name))) failures.push("自有字体文件");
  for (const match of content.matchAll(/(?:url\(\s*["']?|["'])([^\s"'()<>]+\.(?:woff2?|ttf|otf|eot)(?:[?#][^\s"'()<>]*)?)/gi)) {
    if (!functionalFontPattern.test(basename(match[1].split(/[?#]/)[0]))) failures.push(`自有字体请求 ${match[1]}`);
  }
  for (const [rule] of content.matchAll(/@font-face\s*\{[^}]*\}/gi)) {
    if (!/font-family\s*:\s*["']?(?:KaTeX_|Material(?:Icons|Symbols))/i.test(rule)) failures.push("自有 @font-face");
  }
  return failures;
}

export function scanSystemFonts(root, directories) {
  const failures = [];
  let files = 0;
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") walk(file);
      } else if (entry.isFile() && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) {
        files++;
        const content = /\.(?:[cm]?[jt]sx?|css|html|json|map|svg|webmanifest)$/.test(entry.name) ? readFileSync(file, "utf8") : "";
        for (const violation of fontViolations(file, content)) failures.push(`${relative(root, file)}: ${violation}`);
      }
    }
  }
  for (const directory of directories) {
    const target = resolve(root, directory);
    if (!statSync(target, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`字体扫描目录不存在：${directory}`);
    walk(target);
  }
  return { files, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const build = process.argv.includes("--build");
  const directories = build
    ? [".next/static", ".next/server", ".next/standalone", "public"]
    : ["src", "public"];
  const result = scanSystemFonts(process.cwd(), directories);
  if (!build) {
    for (const name of ["package.json", "pnpm-lock.yaml"]) {
      for (const violation of fontViolations(name, readFileSync(name, "utf8").replace(/integrity: sha\d+-[A-Za-z0-9+/=]+/g, ""))) result.failures.push(`${name}: ${violation}`);
    }
  }
  if (result.failures.length) throw new Error(`系统字体检查失败：\n${result.failures.join("\n")}`);
  console.log(`系统字体检查通过：${directories.join("、")}，${result.files} 个文件，无旧字体、自有字体资产或失效入口`);
}
