/** 编辑器提及协议：识别稳定用户链接并将其标记为不可编辑原子内容 */

const USER_MENTION_HREF_RE = /^\/users\/([a-zA-Z0-9_-]+)$/u;

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
      }
      return;
    }
    anchor.setAttribute("contenteditable", "false");
    anchor.setAttribute("spellcheck", "false");
    anchor.dataset.mentionId = userId;
    marked += 1;
  });
  return marked;
}
