import type { components } from "@/api/types";

export type MarkdownMediaAudio = components["schemas"]["AudioMediaDto"];

/** 只接受服务端精确来源投影；绝不按扩展名或相似 URL 推断。 */
export function findMediaAudio(sourceUrl: string, mappings?: readonly MarkdownMediaAudio[]): MarkdownMediaAudio | undefined {
  return mappings?.find((audio) => audio.sourceUrl === sourceUrl && isValidMediaAudio(audio));
}

export function isValidMediaAudio(value: unknown): value is MarkdownMediaAudio {
  if (!value || typeof value !== "object") return false;
  const audio = value as Record<string, unknown>;
  if (typeof audio.sourceUrl !== "string" || typeof audio.mediaId !== "string" || !audio.mediaId.trim()
    || audio.contentType !== "audio/mpeg" || !Number.isSafeInteger(audio.size) || Number(audio.size) <= 0
    || !Number.isSafeInteger(audio.durationMs) || Number(audio.durationMs) <= 0 || Number(audio.durationMs) > 600_000) return false;
  try {
    const url = new URL(audio.sourceUrl);
    return (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]", "10.0.2.2"].includes(url.hostname))) && !url.username && !url.password && audio.sourceUrl === audio.sourceUrl.trim() && !/[\u0000-\u001f\u007f]/u.test(audio.sourceUrl);
  } catch { return false; }
}

type AudioAstNode = {
  type: string;
  url?: string;
  title?: string | null;
  children?: AudioAstNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
};

function supportedLabel(node: AudioAstNode): boolean {
  return ["text", "strong", "emphasis", "delete", "inlineCode"].includes(node.type)
    && (node.children?.every(supportedLabel) ?? true);
}

/** 仅顶层独立链接升级，原 label 子树（包括 marks）原样保留。 */
export function remarkMediaAudio(mappings?: readonly MarkdownMediaAudio[]) {
  return () => (tree: AudioAstNode) => {
    for (const paragraph of tree.children ?? []) {
      if (paragraph.type !== "paragraph" || paragraph.children?.length !== 1) continue;
      let link = paragraph.children[0];
      let labelParent: AudioAstNode = paragraph;
      // 外层格式与 link 内 marks 语义相同，只展开单子节点链，不接纳混排或多个链接。
      while (["strong", "emphasis", "delete"].includes(link.type) && link.children?.length === 1) {
        labelParent = link; link = link.children[0];
      }
      if (link.type !== "link"
        || link.title != null || !link.children?.every(supportedLabel) || !link.url || !findMediaAudio(link.url, mappings)) continue;
      paragraph.data = { ...paragraph.data, hName: "div", hProperties: { "data-audio-source": link.url } };
      labelParent.children = link.children;
    }
  };
}
