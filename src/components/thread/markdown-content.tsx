/** MarkdownContent：安全渲染完整 Markdown 正文并保留空段落。 */

"use client";

import {
  isValidElement,
  useState,
  type ComponentProps,
  type ClipboardEvent as ReactClipboardEvent,
  type ReactNode,
} from "react";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import { createPortal } from "react-dom";
import remarkGfm from "remark-gfm";
import { getMarkdownImageVariantUrl } from "@/lib/upload-image";
import {
  ACTIVE_MARKDOWN_CONTRACT_VERSION,
  prepareMarkdownForReader,
} from "@/lib/markdown";
import {
  DICE_INLINE_MARKER_SOURCE,
  describeInlineDicePending,
  formatInlineDicePending,
  type InlineDiceRoll,
} from "@/lib/dice-inline";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { cn } from "@/lib/utils";
import { SaveStickerButton } from "@/components/sticker/save-sticker-button";
import { STICKER_DISPLAY_STYLE } from "@/lib/sticker-display";
import {
  INTERNAL_REFERENCE_DEFAULT_LABEL,
  parseInternalReference,
  tokenizeInternalReferenceText,
} from "@/lib/internal-reference";
import { InternalReferenceLink } from "@/components/shared/internal-reference-link";
import { ContentLink } from "@/components/ui/content-link";
import { DiceInlineResult } from "@/components/thread/dice-inline-result";
import { remarkRecoverAttentionBoundaries } from "@/lib/markdown-attention";
import { remarkWenyouAlignment } from "@/lib/markdown-alignment";
import {
  createReaderSelectionClipboardPayload,
  setSiteClipboardData,
  SITE_CLIPBOARD_MEDIA_ATTRIBUTE,
} from "@/lib/site-clipboard";

/** 新媒体使用 media/ 标准化主图；uploads/ 仅为历史兼容。 */
function isUploadedMediaUrl(url: string): boolean {
  return (
    (url.includes("/media/") || url.includes("/uploads/")) &&
    !url.endsWith("_md.webp") &&
    !url.endsWith("_thumb.webp")
  );
}

/** GIF 派生图仅有静态首帧，正文直接使用原图让浏览器按文件设置播放。 */
function isGifUrl(url: string): boolean {
  return /\.gif(?:[?#]|$)/iu.test(url);
}

type ImageProps = ComponentProps<"img"> & ExtraProps;
type AnchorProps = ComponentProps<"a"> & ExtraProps;
type SpanProps = ComponentProps<"span"> & ExtraProps & {
  "data-dice-node-id"?: string;
  "data-dice-notation"?: string;
};

function getNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return getNodeText(node.props.children);
  return "";
}

function getInternalMarkdownHref(href: string) {
  let decodedHref = href;
  try {
    decodedHref = decodeURI(href);
  } catch {
    // 交给统一解析器判无效，不为坏编码抛出渲染异常。
  }
  const trailing = decodedHref.match(/[，。！？；：、]+$/u)?.[0] ?? "";
  const candidate = trailing ? decodedHref.slice(0, -trailing.length) : decodedHref;
  return { reference: parseInternalReference(candidate), trailing, candidate };
}

function MarkdownLink({ href, children, node: _node, ...props }: AnchorProps) {
  void _node;
  const internalHref = typeof href === "string" ? getInternalMarkdownHref(href) : null;
  if (internalHref?.reference) {
    const childText = getNodeText(children);
    const comparableChildText = internalHref.trailing && childText.endsWith(internalHref.trailing)
      ? childText.slice(0, -internalHref.trailing.length)
      : childText;
    const label = comparableChildText.trim()
      && comparableChildText.trim() !== href
      && comparableChildText.trim() !== internalHref.candidate
      ? comparableChildText.trim()
      : INTERNAL_REFERENCE_DEFAULT_LABEL;
    return (
      <>
        <InternalReferenceLink href={internalHref.reference.href} label={label} />
        {internalHref.trailing}
      </>
    );
  }
  const userMatch = typeof href === "string" ? /^\/users\/([^/]+)$/u.exec(href) : null;
  if (userMatch) {
    const label = getNodeText(children).trim();
    return (
      <ContentLink
        href={`/users/${userMatch[1]}`}
        mention={label.startsWith("@")}
        {...props}
      >
        {children}
      </ContentLink>
    );
  }
  return (
    <ContentLink
      href={href ?? ""}
      external={typeof href === "string" && /^https?:\/\//iu.test(href)}
      {...props}
    >
      {children}
    </ContentLink>
  );
}

/** 图片组件：本站静态图显示中图，GIF 默认播放原图；点击打开原图 lightbox */
function MarkdownImage({ src, alt, title, sourcePostId }: ImageProps & { sourcePostId?: string }) {
  const originalUrl = typeof src === "string" ? src : "";
  const sticker = typeof title === "string" && title.startsWith("wenyousite-sticker:v1:");
  const mediumUrl = isUploadedMediaUrl(originalUrl) && !isGifUrl(originalUrl)
    ? getMarkdownImageVariantUrl(originalUrl, "md")
    : originalUrl;
  const [failed, setFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const displaySrc = failed ? originalUrl : mediumUrl;

  // 空 URL 图片（历史脏数据如 ![1.00]()）直接不渲染，避免破图图标 + alt 泄漏
  if (!originalUrl) return null;

  const canSave = !!sourcePostId && (isUploadedMediaUrl(originalUrl) || originalUrl.includes("/stickers/"));

  return (
    <>
      <span
        {...{ [SITE_CLIPBOARD_MEDIA_ATTRIBUTE]: sticker ? "sticker" : "image" }}
        {...(!sticker ? { "data-wenyou-media": "image" } : {})}
        className={cn("group/sticker-image relative", sticker ? "mx-0.5 inline-flex align-middle" : "mx-0 my-2 block w-fit max-w-full")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- COS 远程图 + onError 回退 + lightbox，用原生 img */}
        <img
          src={displaySrc}
          alt={alt ?? ""}
          {...{ [SITE_CLIPBOARD_MEDIA_ATTRIBUTE]: sticker ? "sticker" : "image" }}
          loading="lazy"
          className={cn(
            "cursor-zoom-in object-contain",
            sticker ? "sticker-display inline-block rounded" : "block max-w-full rounded-lg",
          )}
          style={sticker
            ? STICKER_DISPLAY_STYLE
            : { maxWidth: "100%", maxHeight: "50vh", height: "auto" }}
          onError={() => {
            if (mediumUrl !== originalUrl) setFailed(true);
          }}
          onClick={() => setLightboxOpen(true)}
        />
        {canSave && (
          <SaveStickerButton
            source={{ postId: sourcePostId!, imageUrl: originalUrl }}
            className="absolute right-1 top-1 opacity-0 shadow-sm transition-opacity group-hover/sticker-image:opacity-100 group-focus-within/sticker-image:opacity-100"
          />
        )}
      </span>
      {lightboxOpen && typeof document !== "undefined" && createPortal(
        <ImageLightbox
          src={originalUrl}
          alt={alt}
          onClose={() => setLightboxOpen(false)}
        />,
        document.body,
      )}
    </>
  );
}

type MarkdownNode = {
  type?: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
};

const EMPTY_PARAGRAPH_RE = /^ {0,3}<br\s*\/?>[\t ]*$/iu;

/** 将 Milkdown 顶层空段落标记转换为安全的 Markdown break 节点，其他 HTML 不开放。 */
function remarkMilkdownEmptyParagraphs() {
  return (tree: MarkdownNode) => {
    if (!tree.children) return;
    tree.children = tree.children.flatMap((node) => {
      if (node.type !== "html") return [node];
      const lines = (node.value ?? "").split("\n");
      if (!lines.every((line) => EMPTY_PARAGRAPH_RE.test(line))) return [node];
      return lines.map(() => ({
        type: "paragraph",
        children: [{ type: "break" }],
      }));
    });
  };
}

function remarkInlineDice(rolls: InlineDiceRoll[]) {
  const byNodeId = new Map(rolls.map((roll) => [roll.nodeId, roll]));
  return () => (tree: MarkdownNode) => {
    const transform = (node: MarkdownNode) => {
      if (!node.children) return;
      const children: MarkdownNode[] = [];
      for (const child of node.children) {
        if (child.type !== "text" || !child.value) {
          transform(child);
          children.push(child);
          continue;
        }
        const matcher = new RegExp(DICE_INLINE_MARKER_SOURCE, "giu");
        let lastIndex = 0;
        for (const match of child.value.matchAll(matcher)) {
          if (match.index > lastIndex) {
            children.push({ type: "text", value: child.value.slice(lastIndex, match.index) });
          }
          const nodeId = match[1]!.toLowerCase();
          const notation = match[2]!;
          const roll = byNodeId.get(nodeId);
          children.push({
            type: "diceInline",
            children: [{
              type: "text",
              value: roll ? roll.notation : formatInlineDicePending(notation),
            }],
            data: {
              hName: "span",
              hProperties: {
                className: roll ? undefined : ["dice-inline", "dice-inline-pending"],
                role: roll ? undefined : "note",
                ariaLabel: roll ? undefined : describeInlineDicePending(notation),
                "data-dice-node-id": nodeId,
                "data-dice-notation": notation,
              },
            },
          });
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex === 0) {
          children.push(child);
        } else if (lastIndex < child.value.length) {
          children.push({ type: "text", value: child.value.slice(lastIndex) });
        }
      }
      node.children = children;
    };
    transform(tree);
  };
}

/** GFM 不会自动链接相对地址；在文本节点内把裸站内坐标提升为统一链接节点。 */
function remarkBareInternalReferences() {
  return (tree: MarkdownNode) => {
    const transform = (node: MarkdownNode) => {
      if (!node.children || node.type === "link" || node.type === "code" || node.type === "inlineCode") return;
      const children: MarkdownNode[] = [];
      for (const child of node.children) {
        if (child.type !== "text" || !child.value) {
          transform(child);
          children.push(child);
          continue;
        }
        const segments = tokenizeInternalReferenceText(child.value);
        if (!segments.some((segment) => segment.type === "portal")) {
          children.push(child);
          continue;
        }
        for (const segment of segments) {
          if (segment.type === "text") {
            if (segment.value) children.push({ type: "text", value: segment.value });
          } else {
            children.push({
              type: "link",
              url: segment.reference.href,
              children: [{ type: "text", value: segment.label }],
            } as MarkdownNode);
          }
        }
      }
      node.children = children;
    };
    transform(tree);
  };
}

/** 完整正文把 CommonMark 软换行显式渲染为换行，与 Flutter 阅读态保持一致。 */
function remarkPreserveSoftLineBreaks() {
  return (tree: MarkdownNode) => {
    const transform = (node: MarkdownNode) => {
      if (!node.children) return;
      const children: MarkdownNode[] = [];
      for (const child of node.children) {
        if (child.type !== "text" || !child.value?.includes("\n")) {
          transform(child);
          children.push(child);
          continue;
        }
        const lines = child.value.split("\n");
        for (let index = 0; index < lines.length; index++) {
          if (index > 0) children.push({ type: "break" });
          if (lines[index]) children.push({ ...child, value: lines[index] });
        }
      }
      node.children = children;
    };
    transform(tree);
  };
}

interface MarkdownContentProps {
  content: string;
  diceRolls?: InlineDiceRoll[];
  sourcePostId?: string;
  size?: "reading" | "compact";
  markdownContractVersion?: number;
}

export function MarkdownContent({
  content,
  diceRolls = [],
  sourcePostId,
  size = "reading",
  markdownContractVersion = ACTIVE_MARKDOWN_CONTRACT_VERSION,
}: MarkdownContentProps) {
  const markdownOptions = { markdownContractVersion };
  const normalizedContent = prepareMarkdownForReader(content, markdownOptions);
  const diceRollsByNodeId = new Map(diceRolls.map((roll) => [roll.nodeId, roll]));
  const handleCopy = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    const payload = createReaderSelectionClipboardPayload(event.currentTarget, selection);
    if (payload) {
      setSiteClipboardData(event.clipboardData, payload);
    } else if (
      selection
      && !selection.isCollapsed
      && selection.rangeCount === 1
      && (
        event.currentTarget.contains(selection.getRangeAt(0).startContainer)
        || event.currentTarget.contains(selection.getRangeAt(0).endContainer)
      )
    ) {
      event.clipboardData.setData("text/plain", selection.toString());
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      data-slot="markdown-content"
      data-size={size}
      onCopy={handleCopy}
      className={cn(
        "prose wenyou-prose prose-headings:text-foreground prose-a:text-brand-strong",
        size === "compact" && "wenyou-prose-compact",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          [remarkWenyouAlignment, markdownOptions],
          remarkRecoverAttentionBoundaries,
          remarkMilkdownEmptyParagraphs,
          remarkInlineDice(diceRolls),
          remarkBareInternalReferences,
          remarkPreserveSoftLineBreaks,
        ]}
        components={{
          a: MarkdownLink,
          img: (props) => <MarkdownImage {...props} sourcePostId={sourcePostId} />,
          span: ({ node: _node, ...props }: SpanProps) => {
            void _node;
            const nodeId = props["data-dice-node-id"];
            const roll = nodeId ? diceRollsByNodeId.get(nodeId) : undefined;
            if (roll) return <DiceInlineResult roll={roll} />;
            return <span {...props} />;
          },
        }}
        skipHtml
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
