export function getLoginTerminalLabel(platform: string) {
  if (platform === "mobile") return "移动端登录";
  if (platform === "web") return "Web 端登录";
  return "其他终端登录";
}
