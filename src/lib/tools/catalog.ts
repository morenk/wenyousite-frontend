export const TOOLS = [
  { id: "vertical", title: "文字竖排", description: "让文字从右向左，慢慢读。", icon: "editor.alignment", sample: "山 海\n海 有\n有 信" },
  { id: "morse", title: "摩斯编码", description: "把想说的话，藏进点与划。", icon: "editor.inline-code", sample: "... --- ..." },
  { id: "fancy", title: "花体英文", description: "同一句英文，换一种笔触。", icon: "editor.italic", sample: "𝒲𝑒𝓃𝓎𝑜𝓊" },
  { id: "names", title: "起名工具", description: "为故事里的人，找一个名字。", icon: "content.roleplay", sample: "林知遥 · Émile" },
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
