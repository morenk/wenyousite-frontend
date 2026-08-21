export const INTERNAL_REFERENCE_DEFAULT_LABEL = "传送门";
export const INTERNAL_REFERENCE_INVITE_PREVIEW_LABEL = "邀请传送门";
export const INTERNAL_REFERENCE_PRODUCTION_ORIGIN = "https://wenyou.site";

const ID_RE = /^[a-z0-9]{20,32}$/u;
const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16}$/u;
const THREAD_ROUTE_RE = /^\/threads\/([^/]+)$/u;
const DISCUSSION_ROUTE_RE = /^\/threads\/([^/]+)\/posts\/([^/]+)\/replies$/u;
const INVITE_ROUTE_RE = /^\/join\/([^/]+)$/u;
const TRAILING_PUNCTUATION_RE = /[.,!?;:，。！？；：、]+$/u;
const REFERENCE_CANDIDATE_RE = /\[((?:\\.|[^\]\\\r\n])+)\]\(([^)\r\n]+)\)|https:\/\/(?:www\.)?wenyou\.site\/(?:threads\/[a-z0-9_-]+(?:\/posts\/[a-z0-9_-]+\/replies)?|join\/[a-z0-9_-]+)(?:\?[^\s<>\])}.,!;:，。！？；：、]+)?|\/(?:threads\/[a-z0-9_-]+(?:\/posts\/[a-z0-9_-]+\/replies)?|join\/[a-z0-9_-]+)(?:\?[^\s<>\])}.,!;:，。！？；：、]+)?/giu;
const BARE_REFERENCE_LEFT_BOUNDARY_RE = /[\s([{"'，。！？；：、]/u;
const BARE_REFERENCE_RIGHT_BOUNDARY_RE = /[\s)\]}"'.,!?;:，。！？；：、]/u;
const INVITE_MARKDOWN_PREVIEW_RE = /\[((?:\\.|[^\]\\\r\n])+)\]\(\s*(?:https:\/\/(?:www\.)?wenyou\.site)?\/join\/[A-Za-z0-9_-]+(?:[?#][^)\s]*)?\s*\)/giu;
const INVITE_LOCATION_PREVIEW_RE = /(?:https:\/\/(?:www\.)?wenyou\.site)?\/join\/[A-Za-z0-9_-]+(?:[?#][^\s<>()\]}"']*)?/giu;

export type InternalReference =
  | { kind: "THREAD"; threadId: string; href: string }
  | { kind: "SUBTHREAD"; threadId: string; subthreadId: string; href: string }
  | { kind: "FLOOR"; threadId: string; postId: string; href: string }
  | { kind: "DISCUSSION"; threadId: string; floorPostId: string; href: string }
  | { kind: "REPLY"; threadId: string; floorPostId: string; postId: string; href: string }
  | { kind: "INVITE"; token: string; href: string };

export type InternalReferenceKind = InternalReference["kind"];

export type InternalReferenceTextSegment =
  | { type: "text"; value: string }
  | {
      type: "portal";
      label: string;
      reference: InternalReference;
      source: string;
      syntax: "explicit" | "bare";
    };

function isValidId(value: string | null): value is string {
  return !!value && ID_RE.test(value);
}

function hasOnlyQuery(url: URL, allowed: string | null): boolean {
  const keys = [...url.searchParams.keys()];
  return allowed === null
    ? keys.length === 0
    : keys.length === 1 && keys[0] === allowed && url.searchParams.getAll(allowed).length === 1;
}

function hasThreadCoordinateQuery(url: URL): boolean {
  const keys = [...url.searchParams.keys()];
  const uniqueKeys = new Set(keys);
  return uniqueKeys.has("post")
    && [...uniqueKeys].every((key) => key === "post" || key === "subthread")
    && [...uniqueKeys].every((key) => url.searchParams.getAll(key).length === 1);
}

function isProductionHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "wenyou.site" || normalized === "www.wenyou.site";
}

function decodedRouteValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** 识别并规范化 v1 站内主题坐标；只做语法判断，不探测目标是否存在。 */
export function parseInternalReference(input: string): InternalReference | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes("#")) return null;

  const relative = trimmed.startsWith("/") && !trimmed.startsWith("//");
  let url: URL;
  try {
    url = new URL(trimmed, INTERNAL_REFERENCE_PRODUCTION_ORIGIN);
  } catch {
    return null;
  }
  if (!relative && (url.protocol !== "https:" || !isProductionHost(url.hostname) || url.port)) {
    return null;
  }
  if (url.username || url.password) return null;

  const threadRoute = THREAD_ROUTE_RE.exec(url.pathname);
  if (threadRoute) {
    const threadId = decodedRouteValue(threadRoute[1]);
    if (!isValidId(threadId)) return null;
    const subthreadId = url.searchParams.get("subthread");
    const postId = url.searchParams.get("post");
    if (postId !== null) {
      if (!isValidId(postId) || !hasThreadCoordinateQuery(url)) return null;
      return {
        kind: "FLOOR",
        threadId,
        postId,
        href: `/threads/${threadId}?post=${postId}`,
      };
    }
    if (subthreadId !== null) {
      if (!isValidId(subthreadId) || !hasOnlyQuery(url, "subthread")) return null;
      return {
        kind: "SUBTHREAD",
        threadId,
        subthreadId,
        href: `/threads/${threadId}?subthread=${subthreadId}`,
      };
    }
    return hasOnlyQuery(url, null)
      ? { kind: "THREAD", threadId, href: `/threads/${threadId}` }
      : null;
  }

  const inviteRoute = INVITE_ROUTE_RE.exec(url.pathname);
  if (inviteRoute) {
    const token = decodedRouteValue(inviteRoute[1]);
    return token && INVITE_TOKEN_RE.test(token) && hasOnlyQuery(url, null)
      ? { kind: "INVITE", token, href: `/join/${token}` }
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

export function decodeInternalReferenceLabel(value: string): string {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const escaped = value[index + 1];
    if (character === "\\" && (escaped === "\\" || escaped === "[" || escaped === "]")) {
      output += escaped;
      index += 1;
    } else {
      output += character;
    }
  }
  return output;
}

/** 动态/评论的受限内联解析：只识别传送门，其他 Markdown 保持字面文本。 */
export function tokenizeInternalReferenceText(value: string): InternalReferenceTextSegment[] {
  const segments: InternalReferenceTextSegment[] = [];
  let offset = 0;
  for (const match of value.matchAll(REFERENCE_CANDIDATE_RE)) {
    const index = match.index;
    if (index > offset) segments.push({ type: "text", value: value.slice(offset, index) });
    const candidate = match[0];
    const label = match[1] ? decodeInternalReferenceLabel(match[1]).trim() : undefined;
    const markdownHref = match[2]?.trim();
    const trailing = markdownHref ? "" : candidate.match(TRAILING_PUNCTUATION_RE)?.[0] ?? "";
    const href = markdownHref ?? (trailing ? candidate.slice(0, -trailing.length) : candidate);
    const previousCharacter = index > 0 ? value[index - 1] : "";
    const nextCharacter = value[index + candidate.length] ?? "";
    const hasBareBoundary = !!markdownHref
      || ((!previousCharacter || BARE_REFERENCE_LEFT_BOUNDARY_RE.test(previousCharacter))
        && (!nextCharacter || BARE_REFERENCE_RIGHT_BOUNDARY_RE.test(nextCharacter)));
    const reference = hasBareBoundary ? parseInternalReference(href) : null;
    if (reference) {
      segments.push({
        type: "portal",
        label: label || INTERNAL_REFERENCE_DEFAULT_LABEL,
        reference,
        source: markdownHref ? candidate : href,
        syntax: markdownHref ? "explicit" : "bare",
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

export function formatInternalReferencePreview(
  value: string,
  options: { redactInvites?: boolean } = {},
): string {
  const preview = tokenizeInternalReferenceText(value)
    .map((segment) => {
      if (segment.type === "text") return segment.value;
      return options.redactInvites && segment.reference.kind === "INVITE"
        ? INTERNAL_REFERENCE_INVITE_PREVIEW_LABEL
        : segment.label;
    })
    .join("");
  if (!options.redactInvites) return preview;
  return preview
    .replace(INVITE_MARKDOWN_PREVIEW_RE, INTERNAL_REFERENCE_INVITE_PREVIEW_LABEL)
    .replace(INVITE_LOCATION_PREVIEW_RE, INTERNAL_REFERENCE_INVITE_PREVIEW_LABEL);
}

export function formatDirectMessagePreview(value: string): string {
  return formatInternalReferencePreview(value, { redactInvites: true })
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 120);
}

export function getInternalInviteReferenceSignature(value: string): string | null {
  const inviteHrefs = tokenizeInternalReferenceText(value)
    .flatMap((segment) => segment.type === "portal" && segment.reference.kind === "INVITE"
      ? [segment.reference.href]
      : []);
  return inviteHrefs.length > 0 ? JSON.stringify(inviteHrefs) : null;
}

export function serializeInternalReference(label: string, href: string): string | null {
  const reference = parseInternalReference(href);
  const normalizedLabel = label.trim();
  if (!reference || !normalizedLabel || /[\r\n]/u.test(normalizedLabel)) return null;
  const escapedLabel = normalizedLabel.replace(/\\/gu, "\\\\").replace(/\[/gu, "\\[").replace(/\]/gu, "\\]");
  return `[${escapedLabel}](${reference.href})`;
}

export interface InternalReferencePaste {
  label: string;
  reference: InternalReference;
  serialized: string;
}

export function resolveInternalReferencePaste({
  clipboardText,
  selectedText,
}: {
  clipboardText: string;
  selectedText: string;
}): InternalReferencePaste | null {
  const reference = parseInternalReference(clipboardText.trim());
  if (!reference) return null;
  const label = selectedText.trim() || INTERNAL_REFERENCE_DEFAULT_LABEL;
  const serialized = serializeInternalReference(label, reference.href);
  return serialized ? { label, reference, serialized } : null;
}

export function containsInternalInviteReference(value: string): boolean {
  return getInternalInviteReferenceSignature(value) !== null;
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
