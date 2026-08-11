import { DICE_INLINE_MARKER_SOURCE } from "@/lib/dice-inline";
import { formatInternalReferencePreview } from "@/lib/internal-reference";

const IMAGE_RE = /!\[[^\]]*\]\((?:\\.|[^)])*\)/gu;
const INLINE_LINK_RE = /\[([^\]\r\n]+)\]\((?:\\.|[^)])*\)/gu;
const REFERENCE_LINK_RE = /\[([^\]\r\n]+)\]\[[^\]\r\n]*\]/gu;
const AUTOLINK_RE = /<(?:https?:\/\/|mailto:)[^>\r\n]+>/giu;
const BARE_URL_RE = /(?:https?:\/\/|www\.)[^\s<\])]+/giu;
const EMPTY_PARAGRAPH_RE = /^ {0,3}<br\s*\/?>[\t ]*$/gimu;

/** 将 Markdown 正文转换为适合卡片、搜索和通知使用的紧凑纯文本预览。 */
export function formatMarkdownPreview(markdown: string): string {
  const diceMarker = new RegExp(DICE_INLINE_MARKER_SOURCE, "giu");

  return formatInternalReferencePreview(markdown)
    .replace(diceMarker, (_marker, _nodeId: string, notation: string) =>
      `[${notation}]`)
    .replace(IMAGE_RE, "[图片]")
    .replace(INLINE_LINK_RE, (_link, label: string) => `[${label.trim()}]`)
    .replace(REFERENCE_LINK_RE, (_link, label: string) => `[${label.trim()}]`)
    .replace(AUTOLINK_RE, "[链接]")
    .replace(BARE_URL_RE, (url) => {
      const trailing = url.match(/[.,!?;:，。！？；：、]+$/u)?.[0] ?? "";
      return `[链接]${trailing}`;
    })
    .replace(EMPTY_PARAGRAPH_RE, "")
    .replace(/^ {0,3}#{1,6}[\t ]+/gmu, "")
    .replace(/^ {0,3}>[\t ]?/gmu, "")
    .replace(/^ {0,3}(?:[-+*]|\d+[.)])[\t ]+/gmu, "")
    .replace(/(`{1,3})([^`\r\n]+)\1/gu, "$2")
    .replace(/(\*\*|__|~~)(.*?)\1/gu, "$2")
    .replace(/\*([^*\r\n]+)\*/gu, "$1")
    .replace(/_([^_\r\n]+)_/gu, "$1")
    .replace(/\\([!-/:-@[-`{-~])/gu, "$1")
    .replace(/[\t ]*\n[\t ]*/gu, " ")
    .replace(/\s{2,}/gu, " ")
    .trim();
}
