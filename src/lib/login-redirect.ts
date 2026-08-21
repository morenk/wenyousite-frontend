const DEFAULT_NEXT_PATH = "/";

/** 登录完成后只允许返回站内路径，避免开放重定向。 */
export function safeLoginNextPath(value: string | null | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : DEFAULT_NEXT_PATH;
}

export function buildLoginHref(next: string) {
  return `/login?next=${encodeURIComponent(safeLoginNextPath(next))}`;
}
