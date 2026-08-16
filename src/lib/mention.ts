/** 编辑器提及协议：识别稳定用户链接并将其标记为不可编辑原子内容 */

import { isMarkdownEscaped, maskMarkdownCode } from "@/lib/markdown-code";

const USER_MENTION_HREF_RE = /^\/users\/([a-zA-Z0-9_-]+)$/u;
const INLINE_USER_MENTION_RE = /\[(@[^\]\r\n]+)\]\(\/users\/([a-zA-Z0-9_-]+)\)/gu;
const ALL_PLAYERS_MENTION_RE = /@全体玩家/gu;

export type InlineMentionNode =
  | { type: "mention"; userId: string; label: string }
  | { type: "mention_all_players"; label: "@全体玩家" };

/** 解析代码与转义边界外的稳定提及节点；显示名不承担身份。 */
export function parseInlineMentionNodes(content: string): InlineMentionNode[] {
  const masked = maskMarkdownCode(content);
  const matches: Array<{ index: number; node: InlineMentionNode }> = [];

  for (const match of masked.matchAll(INLINE_USER_MENTION_RE)) {
    if (isMarkdownEscaped(content, match.index)) continue;
    matches.push({
      index: match.index,
      node: { type: "mention", userId: match[2]!, label: match[1]! },
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
    ? `[${node.label}](/users/${node.userId})`
    : node.label;
}

/** 返回稳定提及的 userId；显示标签只参与协议识别，不作为身份依据。 */
export function getMentionUserId(
  href: string | null | undefined,
  label: string | null | undefined,
): string | null {
  if (!href || !label?.startsWith("@") || label.length <= 1) return null;
  return USER_MENTION_HREF_RE.exec(href)?.[1] ?? null;
}

/** 标记编辑器内已有及新插入的提及链接，使光标不能进入并修改稳定实体。 */
export function markEditorMentionAnchors(root: ParentNode): number {
  let marked = 0;
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
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
      }
      return;
    }
    anchor.setAttribute("contenteditable", "false");
    anchor.setAttribute("spellcheck", "false");
    anchor.dataset.mentionId = userId;
    anchor.dataset.slot = "mention-link";
    marked += 1;
  });
  return marked;
}
