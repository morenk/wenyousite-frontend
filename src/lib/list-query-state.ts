import { getApiError } from "@/api/errors";

/** 读取权限或资源失效后隐藏旧数据；临时读取错误保留已经加载的条目。 */
export function isListAccessError(error: unknown): boolean {
  const { status, code } = getApiError(error);
  const family = code === undefined ? undefined : Math.floor(code / 100);
  return [401, 403, 404].includes(status ?? 0) || [401, 403, 404].includes(family ?? 0);
}

/** 识别用户列表的 404；具体不可访问原因与文案遵循各分区契约。 */
export function isUserListUnavailable(error: unknown): boolean {
  const { status, code } = getApiError(error);
  return status === 404 || code === 40401 || code === 40400;
}
