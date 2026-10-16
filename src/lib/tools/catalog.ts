export const TOOLS = [
  { id: "vertical", title: "文字竖排", icon: "action.sort" },
  { id: "morse", title: "摩斯编码", icon: "editor.inline-code" },
  { id: "fancy", title: "花体字", icon: "editor.italic" },
  { id: "names", title: "起名工具", icon: "identity.member" },
] as const;
export type ToolId = (typeof TOOLS)[number]["id"];
export function isToolId(value: string): value is ToolId {
  return TOOLS.some((tool) => tool.id === value);
}
export function isToolEmbedPath(pathname: string) {
  return pathname === "/tools/embed" || pathname.startsWith("/tools/embed/");
}
export function toolHref(id?: ToolId, embedded = false, theme?: string | null) {
  const path = `${embedded ? "/tools/embed" : "/tools"}${id ? `/${id}` : ""}`;
  return embedded && (theme === "light" || theme === "dark") ? `${path}?theme=${theme}` : path;
}
export const TEXT_LIMIT = 10000;
export function assertTextLimit(text: string) {
  if (text.length > TEXT_LIMIT) throw new Error("请将输入控制在 10,000 个字符以内");
}
