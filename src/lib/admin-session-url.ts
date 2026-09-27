/** 登录回跳只接受本站管理工作区，不接收绝对 URL、登录页或邀请链接。 */
export function safeAdminLoginReturn(value: string | null | undefined) {
  if (!value || !value.startsWith("/station/") || /[\\\r\n]/.test(value))
    return "/station/dashboard";
  try {
    const url = new URL(value, "https://admin.invalid");
    const knownWorkspacePath =
      url.pathname === "/station/mobile-releases" ||
      /^\/station\/(dashboard|users|content|announcements|taxonomy|cases|appeals|operations|accounts|audit)(\/|$)/.test(
        url.pathname,
      );
    if (url.origin !== "https://admin.invalid" || !knownWorkspacePath)
      return "/station/dashboard";
    return url.pathname + url.search;
  } catch {
    return "/station/dashboard";
  }
}
export function adminLoginHref(path: string) {
  return "/station?returnTo=" + encodeURIComponent(safeAdminLoginReturn(path));
}
