export const INTERNAL_REFERENCE_DEFAULT_LABEL = "传送门";
export const INTERNAL_REFERENCE_PRODUCTION_ORIGIN = "https://wenyou.site";

const ID_RE = /^[a-z0-9]{20,32}$/u;
const THREAD_ROUTE_RE = /^\/threads\/([^/]+)$/u;
const DISCUSSION_ROUTE_RE = /^\/threads\/([^/]+)\/posts\/([^/]+)\/replies$/u;
const TRAILING_PUNCTUATION_RE = /[.,!?;:，。！？；：、]+$/u;
const REFERENCE_CANDIDATE_RE = /\[([^\]\r\n]+)\]\(([^)\r\n]+)\)|https:\/\/wenyou\.site\/threads\/[a-z0-9_-]+(?:\/posts\/[a-z0-9_-]+\/replies)?(?:\?[^\s<>\])}.,!;:，。！？；：、]+)?|\/threads\/[a-z0-9_-]+(?:\/posts\/[a-z0-9_-]+\/replies)?(?:\?[^\s<>\])}.,!;:，。！？；：、]+)?/giu;
const RELATIVE_REFERENCE_BOUNDARY_RE = /[\s([{"'，。！？；：、]/u;

export type InternalReferenceKind =
  | "THREAD"
  | "SUBTHREAD"
  | "FLOOR"
  | "DISCUSSION"
  | "REPLY";

export interface InternalReference {
  kind: InternalReferenceKind;
  threadId: string;
  subthreadId?: string;
  floorPostId?: string;
  postId?: string;
  href: string;
}

export type InternalReferenceTextSegment =
  | { type: "text"; value: string }
  | { type: "portal"; label: string; reference: InternalReference };

function isValidId(value: string | null): value is string {
  return !!value && ID_RE.test(value);
}

function hasOnlyQuery(url: URL, allowed: string | null): boolean {
  const keys = [...url.searchParams.keys()];
  return allowed === null
    ? keys.length === 0
    : keys.length === 1 && keys[0] === allowed && url.searchParams.getAll(allowed).length === 1;
}

function decodedRouteValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** 识别并规范化 v1 站内主题坐标；只做语法判断，不探测目标是否存在。 */
export function parseInternalReference(
  input: string,
  currentOrigin = typeof window === "undefined" ? undefined : window.location.origin,
): InternalReference | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes("#")) return null;

  const relative = trimmed.startsWith("/") && !trimmed.startsWith("//");
  let url: URL;
  try {
    url = new URL(trimmed, INTERNAL_REFERENCE_PRODUCTION_ORIGIN);
  } catch {
    return null;
  }
  const allowedOrigins = new Set([
    INTERNAL_REFERENCE_PRODUCTION_ORIGIN,
    ...(currentOrigin ? [currentOrigin] : []),
  ]);
  if (!relative && (url.protocol !== "https:" || !allowedOrigins.has(url.origin))) return null;
  if (url.username || url.password) return null;

  const threadRoute = THREAD_ROUTE_RE.exec(url.pathname);
  if (threadRoute) {
    const threadId = decodedRouteValue(threadRoute[1]);
    if (!isValidId(threadId)) return null;
    const subthreadId = url.searchParams.get("subthread");
    const postId = url.searchParams.get("post");
    if (subthreadId !== null) {
      if (!isValidId(subthreadId) || !hasOnlyQuery(url, "subthread")) return null;
      return {
        kind: "SUBTHREAD",
        threadId,
        subthreadId,
        href: `/threads/${threadId}?subthread=${subthreadId}`,
      };
    }
    if (postId !== null) {
      if (!isValidId(postId) || !hasOnlyQuery(url, "post")) return null;
      return {
        kind: "FLOOR",
        threadId,
        postId,
        href: `/threads/${threadId}?post=${postId}`,
      };
    }
    return hasOnlyQuery(url, null)
      ? { kind: "THREAD", threadId, href: `/threads/${threadId}` }
      : null;
  }

  const discussionRoute = DISCUSSION_ROUTE_RE.exec(url.pathname);
  if (!discussionRoute) return null;
  const threadId = decodedRouteValue(discussionRoute[1]);
  const floorPostId = decodedRouteValue(discussionRoute[2]);
  if (!isValidId(threadId) || !isValidId(floorPostId)) return null;
  const postId = url.searchParams.get("post");
  const baseHref = `/threads/${threadId}/posts/${floorPostId}/replies`;
  if (postId !== null) {
    if (!isValidId(postId) || !hasOnlyQuery(url, "post")) return null;
    return { kind: "REPLY", threadId, floorPostId, postId, href: `${baseHref}?post=${postId}` };
  }
  return hasOnlyQuery(url, null)
    ? { kind: "DISCUSSION", threadId, floorPostId, href: baseHref }
    : null;
}

/** 动态/评论的受限内联解析：只识别传送门，其他 Markdown 保持字面文本。 */
export function tokenizeInternalReferenceText(value: string): InternalReferenceTextSegment[] {
  const segments: InternalReferenceTextSegment[] = [];
  let offset = 0;
  for (const match of value.matchAll(REFERENCE_CANDIDATE_RE)) {
    const index = match.index;
    if (index > offset) segments.push({ type: "text", value: value.slice(offset, index) });
    const candidate = match[0];
    const label = match[1]?.trim();
    const markdownHref = match[2]?.trim();
    const trailing = markdownHref ? "" : candidate.match(TRAILING_PUNCTUATION_RE)?.[0] ?? "";
    const href = markdownHref ?? (trailing ? candidate.slice(0, -trailing.length) : candidate);
    const previousCharacter = index > 0 ? value[index - 1] : "";
    const hasRelativeBoundary = !candidate.startsWith("/")
      || !previousCharacter
      || RELATIVE_REFERENCE_BOUNDARY_RE.test(previousCharacter);
    const reference = hasRelativeBoundary ? parseInternalReference(href) : null;
    if (reference) {
      segments.push({
        type: "portal",
        label: label || INTERNAL_REFERENCE_DEFAULT_LABEL,
        reference,
      });
      if (trailing) segments.push({ type: "text", value: trailing });
    } else {
      segments.push({ type: "text", value: candidate });
    }
    offset = index + candidate.length;
  }
  if (offset < value.length) segments.push({ type: "text", value: value.slice(offset) });
  return segments.length > 0 ? segments : [{ type: "text", value }];
}

export function formatInternalReferencePreview(value: string): string {
  return tokenizeInternalReferenceText(value)
    .map((segment) => segment.type === "portal" ? segment.label : segment.value)
    .join("");
}

export function serializeInternalReference(label: string, href: string): string | null {
  const reference = parseInternalReference(href);
  const normalizedLabel = label.trim();
  if (!reference || !normalizedLabel) return null;
  const escapedLabel = normalizedLabel.replace(/\\/gu, "\\\\").replace(/\[/gu, "\\[").replace(/\]/gu, "\\]");
  return `[${escapedLabel}](${reference.href})`;
}

export function insertTextAtSelection(
  value: string,
  insertion: string,
  selectionStart = value.length,
  selectionEnd = selectionStart,
) {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  return {
    value: `${value.slice(0, start)}${insertion}${value.slice(end)}`,
    cursor: start + insertion.length,
  };
}
