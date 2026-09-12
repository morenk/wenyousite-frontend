import { statSync } from "node:fs";
import { resolve } from "node:path";

/** 显式后端来源必须存在；不允许拼错路径后退化为跳过契约核对。 */
export function backendContractRoot(frontendRoot = process.cwd()) {
  const configured = process.env.WENYOUSITE_BACKEND_ROOT;
  const root = resolve(configured || resolve(frontendRoot, "../wenyousite-backend"));
  if (configured && !statSync(resolve(root, "contracts"), { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`WENYOUSITE_BACKEND_ROOT 缺少 contracts 目录：${root}`);
  }
  return root;
}

export function requireConfiguredContract(file) {
  if (process.env.WENYOUSITE_BACKEND_ROOT && !statSync(file, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`指定后端来源缺少契约：${file}`);
  }
}
