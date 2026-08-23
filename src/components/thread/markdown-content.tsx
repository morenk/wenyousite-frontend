/** MarkdownContent：安全渲染 Markdown、保留空段落并折叠超高正文 */

"use client";

import {
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import { createPortal } from "react-dom";
import remarkGfm from "remark-gfm";
import { getMarkdownImageVariantUrl } from "@/lib/upload-image";
import { sanitizeMilkdownMarkdown } from "@/lib/markdown";
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
      <span className={cn("group/sticker-image relative", sticker ? "mx-0.5 inline-flex align-middle" : "mx-auto my-2 block w-fit max-w-full")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- COS 远程图 + onError 回退 + lightbox，用原生 img */}
        <img
          src={displaySrc}
          alt={alt ?? ""}
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
    tree.children = tree.children.map((node) => {
      if (node.type === "html" && EMPTY_PARAGRAPH_RE.test(node.value ?? "")) {
        return {
          type: "paragraph",
          children: [{ type: "break" }],
        };
      }
      return node;
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

const COLLAPSE_TRIGGER_VIEWPORT_RATIO = 1.2;

interface CollapsibleMarkdownProps {
  content: string;
  diceRolls?: InlineDiceRoll[];
  sourcePostId?: string;
  size?: "reading" | "compact";
}

function CollapsibleMarkdown({
  content,
  diceRolls = [],
  sourcePostId,
  size = "reading",
}: CollapsibleMarkdownProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const [tooTall, setTooTall] = useState(false);
  const [expandedContent, setExpandedContent] = useState<string | null>(null);
  const contentId = useId();
  const normalizedContent = sanitizeMilkdownMarkdown(content);
  const expanded = expandedContent === content;
  const diceRollsByNodeId = new Map(diceRolls.map((roll) => [roll.nodeId, roll]));

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const measure = () => {
      setTooTall(
        element.scrollHeight >
          window.innerHeight * COLLAPSE_TRIGGER_VIEWPORT_RATIO,
      );
    };

    measure();
    window.addEventListener("resize", measure);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [normalizedContent]);

  function handleToggle() {
    if (expanded) {
      setExpandedContent(null);
      window.setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
        collapseButtonRef.current?.focus();
      }, 0);
      return;
    }
    setExpandedContent(content);
  }

  const collapsed = tooTall && !expanded;

  return (
    <div className="relative">
      <div
        ref={contentRef}
        id={contentId}
        data-slot="markdown-content"
        data-size={size}
        className={cn(
          "prose wenyou-prose prose-headings:text-foreground prose-a:text-brand-strong",
          size === "compact" && "wenyou-prose-compact",
        )}
        style={collapsed ? { maxHeight: "80vh", overflow: "hidden" } : undefined}
      >
        <ReactMarkdown
          remarkPlugins={[
            remarkGfm,
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

      {tooTall && (
        <>
          {collapsed && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent" />
          )}
          <div className={collapsed ? "absolute inset-x-0 bottom-3 flex justify-center" : "mt-3 flex justify-center"}>
            <button
              ref={collapseButtonRef}
              type="button"
              className="relative z-10 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-bold text-muted-foreground shadow-sm hover:text-foreground"
              aria-controls={contentId}
              aria-expanded={expanded}
              onClick={handleToggle}
            >
              {expanded ? "收起" : "展开全文"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface MarkdownContentProps {
  content: string;
  diceRolls?: InlineDiceRoll[];
  sourcePostId?: string;
  size?: "reading" | "compact";
}

export function MarkdownContent({ content, diceRolls, sourcePostId, size }: MarkdownContentProps) {
  return (
    <CollapsibleMarkdown
      content={content}
      diceRolls={diceRolls}
      sourcePostId={sourcePostId}
      size={size}
    />
  );
}
