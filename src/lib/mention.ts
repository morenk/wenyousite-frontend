/** 编辑器提及协议：识别稳定用户链接并将其标记为不可编辑原子内容 */

import { mentionDisplayName, type MentionIdentity } from "@/lib/thread-identity";
import { isMarkdownEscaped, maskMarkdownCode } from "@/lib/markdown-code";

const USER_MENTION_HREF_RE = /^\/users\/([a-zA-Z0-9_-]+)(?:\?(rpIdentityId=(c[a-z0-9]{24})|identityMode=ACCOUNT))?$/u;
const INLINE_USER_MENTION_RE = /\[(@[^\]\r\n]{1,32})\]\((\/users\/[^)\r\n]+)\)/gu;

export const MENTION_SOURCE_HREF_ATTRIBUTE = "data-wenyou-mention-source-href";
export const MENTION_SOURCE_LABEL_ATTRIBUTE = "data-wenyou-mention-source-label";
export interface MentionTarget {
  userId: string;
  sourceHref: string;
  targetIdentityId: string | null;
  mode: "LEGACY" | "ACCOUNT" | "RP";
}

/** 只接受规范的单一目标；重复参数和跨源链接不能降级成账号提及。 */
export function parseMentionTarget(href: string | null | undefined, label: string | null | undefined): MentionTarget | null {
  if (!href || !label?.startsWith("@") || /[\]\r\n]/u.test(label)) return null;
  const length = Array.from(label.slice(1)).length;
  if (length < 1 || length > 32) return null;
  const match = USER_MENTION_HREF_RE.exec(href);
  if (!match) return null;
  return { userId: match[1]!, sourceHref: href, targetIdentityId: match[3] ?? null,
    mode: match[3] ? "RP" : match[2] ? "ACCOUNT" : "LEGACY" };
}

export function maskMentionCode(content: string): string {
  return maskMarkdownCode(content, (line, index) => {
    if (line[index] !== "[" || line[index + 1] !== "@") return 0;
    const match = /^\[(@[^\]\r\n]{1,32})\]\((\/users\/[^)\r\n]+)\)/u.exec(line.slice(index));
    return match && parseMentionTarget(match[2], match[1]) ? match[0].length : 0;
  });
}

/** 源位置按 UTF-16 保持与 Markdown AST 一致；昵称内标点不再当作格式。 */
export function mentionSourceTokens(content: string) {
  return Array.from(maskMentionCode(content).matchAll(INLINE_USER_MENTION_RE)).flatMap((match) => {
    const target = parseMentionTarget(match[2], match[1]);
    return target && !isMarkdownEscaped(content, match.index)
      ? [{ ...target, label: match[1]!, start: match.index, end: match.index + match[0].length }] : [];
  });
}

const ALL_PLAYERS_MENTION_RE = /@全体玩家/gu;

export type InlineMentionNode =
  | { type: "mention"; userId: string; label: string; sourceHref?: string; targetIdentityId?: string | null }
  | { type: "mention_all_players"; label: "@全体玩家" };

/** 解析代码与转义边界外的稳定提及节点；显示名不承担身份。 */
export function parseInlineMentionNodes(content: string): InlineMentionNode[] {
  const masked = maskMentionCode(content);
  const matches: Array<{ index: number; node: InlineMentionNode }> = [];

  for (const match of masked.matchAll(INLINE_USER_MENTION_RE)) {
    if (isMarkdownEscaped(content, match.index)) continue;
    const target = parseMentionTarget(match[2], match[1]);
    if (!target) continue;
    matches.push({
      index: match.index,
      node: { type: "mention", userId: target.userId, label: match[1]!,
        ...(target.mode !== "LEGACY" ? { sourceHref: target.sourceHref, targetIdentityId: target.targetIdentityId } : {}) },
    });
  }
  for (const match of masked.matchAll(ALL_PLAYERS_MENTION_RE)) {
    if (isMarkdownEscaped(content, match.index)) continue;
    matches.push({
      index: match.index,
      node: { type: "mention_all_players", label: "@全体玩家" },
    });
  }
  return matches.sort((left, right) => left.index - right.index).map(({ node }) => node);
}

export function serializeInlineMentionNode(node: InlineMentionNode): string {
  return node.type === "mention"
    ? `[${node.label}](${node.sourceHref ?? "/users/" + node.userId})`
    : node.label;
}

/** 返回稳定提及的 userId；显示标签只参与协议识别，不作为身份依据。 */
export function getMentionUserId(
  href: string | null | undefined,
  label: string | null | undefined,
): string | null {
  return parseMentionTarget(href, label)?.userId ?? null;
}

/** 标记编辑器内已有及新插入的提及链接，使光标不能进入并修改稳定实体。 */
export function markEditorMentionAnchors(root: ParentNode, identities?: readonly MentionIdentity[]): number {
  let marked = 0;
  const anchors = root instanceof HTMLAnchorElement ? [root] : root.querySelectorAll<HTMLAnchorElement>("a[href]");
  anchors.forEach((anchor) => {
    const userId = getMentionUserId(
      anchor.getAttribute("href"),
      anchor.textContent,
    );
    if (!userId) {
      if (anchor.dataset.mentionId) {
        anchor.removeAttribute("contenteditable");
        anchor.removeAttribute("spellcheck");
        delete anchor.dataset.mentionId;
        delete anchor.dataset.slot;
        delete anchor.dataset.mentionDisplay;
        anchor.removeAttribute(MENTION_SOURCE_HREF_ATTRIBUTE);
        anchor.removeAttribute(MENTION_SOURCE_LABEL_ATTRIBUTE);
        anchor.removeAttribute("aria-label");
      }
      return;
    }
    if (anchor.getAttribute("contenteditable") !== "false") anchor.setAttribute("contenteditable", "false");
    if (anchor.getAttribute("spellcheck") !== "false") anchor.setAttribute("spellcheck", "false");
    if (anchor.dataset.mentionId !== userId) anchor.dataset.mentionId = userId;
    if (anchor.dataset.slot !== "mention-link") anchor.dataset.slot = "mention-link";
    const sourceHref = anchor.getAttribute("href")!;
    if (anchor.getAttribute(MENTION_SOURCE_HREF_ATTRIBUTE) !== sourceHref) anchor.setAttribute(MENTION_SOURCE_HREF_ATTRIBUTE, sourceHref);
    if (anchor.getAttribute(MENTION_SOURCE_LABEL_ATTRIBUTE) !== anchor.textContent) anchor.setAttribute(MENTION_SOURCE_LABEL_ATTRIBUTE, anchor.textContent!);
    const sourceLabel = anchor.textContent!.slice(1);
    const displayName = mentionDisplayName(userId, sourceLabel, identities, anchor.getAttribute("href")!);
    if (displayName !== sourceLabel && anchor.querySelector("[data-editor-mention-source]")) {
      const display = "@" + displayName;
      if (anchor.dataset.mentionDisplay !== display) anchor.dataset.mentionDisplay = display;
      if (anchor.getAttribute("aria-label") !== display) anchor.setAttribute("aria-label", display);
    } else {
      delete anchor.dataset.mentionDisplay;
      anchor.removeAttribute("aria-label");
    }
    marked += 1;
  });
  return marked;
}
