import { INTERNAL_REFERENCE_PRODUCTION_ORIGIN } from "@/lib/internal-reference";

const ID = /^c[a-z0-9]{24}$/u;
export interface RpProfilePostTarget { threadId: string; postId: string; parentPostId?: string }

/** 只解析本站复制楼层链接；实际读权限、主题归属仍必须由帖子详情校验。 */
export function parseRpProfilePostLink(input: string, threadId: string, currentOrigin?: string): RpProfilePostTarget | null {
  const raw = input.trim();
  if (!raw || raw.startsWith("//") || raw.includes("\\") || raw.includes("#")) return null;
  let url: URL;
  try { url = new URL(raw, INTERNAL_REFERENCE_PRODUCTION_ORIGIN); } catch { return null; }
  if (url.username || url.password) return null;
  const relative = raw.startsWith("/");
  const allowed = url.origin === INTERNAL_REFERENCE_PRODUCTION_ORIGIN || url.origin === "https://www.wenyou.site"
    || (currentOrigin !== undefined && url.origin === currentOrigin);
  if (!relative && (!allowed || !["https:", "http:"].includes(url.protocol))) return null;
  const match = /^\/threads\/(c[a-z0-9]{24})(?:\/posts\/(c[a-z0-9]{24})\/replies)?$/u.exec(url.pathname);
  if (!match || match[1] !== threadId) return null;
  const keys = [...url.searchParams.keys()];
  if (keys.some((key) => !["post", "subthread", "order"].includes(key) || url.searchParams.getAll(key).length !== 1)) return null;
  const postId = url.searchParams.get("post");
  if (!postId || !ID.test(postId)) return null;
  const subthread = url.searchParams.get("subthread");
  if (subthread !== null && !ID.test(subthread)) return null;
  const order = url.searchParams.get("order");
  if (order !== null && order !== "NEWEST" && order !== "OLDEST") return null;
  return { threadId, postId, ...(match[2] ? { parentPostId: match[2] } : {}) };
}
