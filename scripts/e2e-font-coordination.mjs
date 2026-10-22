import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** 协作参数只传给测试消费者，不进入产品配置或后端私有凭据。 */
export function fontCoordinationArguments(args) {
  const prefix = "--font-mobile-sha256=";
  const flags = args.filter((arg) => arg.startsWith(prefix));
  const mobileApkSha256 = flags[0]?.slice(prefix.length);
  const browserArgs = args.filter((arg) => !arg.startsWith(prefix));
  if (
    flags.length > 1 ||
    (mobileApkSha256 !== undefined && !/^[a-f0-9]{64}$/u.test(mobileApkSha256))
  )
    throw new Error("Mobile 协作必须指定唯一的 APK SHA-256");
  if (
    mobileApkSha256 &&
    (browserArgs.length !== 1 ||
      browserArgs[0] !== "e2e/dynamic-text-fonts.spec.ts")
  )
    throw new Error("Mobile 协作仅支持单浏览器动态字体旅程");
  return { browserArgs, mobileApkSha256 };
}

/** 对实际编译的 server/static 及运行清单取摘要，不把随机 Build ID 当作构建哈希。 */
export function fontCandidateBuildSha256(root) {
  const hash = createHash("sha256");
  const visit = (relative) => {
    const path = join(root, relative),
      stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("候选构建摘要不接受符号链接");
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(relative + "/" + name);
    } else if (stat.isFile()) {
      hash.update(relative + "\0");
      hash.update(readFileSync(path));
      hash.update("\0");
    } else throw new Error("候选构建包含非常规文件");
  };
  for (const relative of [
    "BUILD_ID",
    "required-server-files.json",
    "routes-manifest.json",
    "server",
    "static",
  ])
    visit(relative);
  return hash.digest("hex");
}
