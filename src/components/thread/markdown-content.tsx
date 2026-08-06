/** MarkdownContent：安全渲染 Markdown、保留空段落并折叠超高正文 */

"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import Link from "next/link";
import remarkGfm from "remark-gfm";
import { getImageUrlBySize } from "@/lib/upload-image";
import { sanitizeMilkdownMarkdown } from "@/lib/markdown";
import {
  DICE_INLINE_MARKER_SOURCE,
  type InlineDiceRoll,
} from "@/lib/dice-inline";
import { ImageLightbox } from "@/components/thread/image-lightbox";

/** 判断是否为本站上传图片（objectKey 统一以 uploads/ 开头）且非派生图 */
function isUploadedMediaUrl(url: string): boolean {
  return (
    url.includes("/uploads/") &&
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

function MarkdownLink({ href, children, ...props }: AnchorProps) {
  const userMatch = typeof href === "string" ? /^\/users\/([^/]+)$/u.exec(href) : null;
  if (userMatch) {
    return (
      <Link
        href={`/users/${userMatch[1]}`}
        className="font-medium text-primary no-underline hover:underline"
      >
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      {...props}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  );
}

/** 图片组件：本站静态图显示中图，GIF 默认播放原图；点击打开原图 lightbox */
function MarkdownImage({ src, alt }: ImageProps) {
  const originalUrl = typeof src === "string" ? src : "";
  const mediumUrl = isUploadedMediaUrl(originalUrl) && !isGifUrl(originalUrl)
    ? getImageUrlBySize(originalUrl, "md")
    : originalUrl;
  const [failed, setFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const displaySrc = failed ? originalUrl : mediumUrl;

  // 空 URL 图片（历史脏数据如 ![1.00]()）直接不渲染，避免破图图标 + alt 泄漏
  if (!originalUrl) return null;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- COS 远程图 + onError 回退 + lightbox，用原生 img */}
      <img
        src={displaySrc}
        alt={alt ?? ""}
        loading="lazy"
        className="mx-auto my-2 block max-w-full cursor-zoom-in rounded-lg"
        style={{ maxWidth: "100%", maxHeight: "50vh", height: "auto" }}
        onError={() => {
          if (mediumUrl !== originalUrl) setFailed(true);
        }}
        onClick={() => setLightboxOpen(true)}
      />
      {lightboxOpen && (
        <ImageLightbox
          src={originalUrl}
          alt={alt}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

const components: Components = {
  img: MarkdownImage,
  a: MarkdownLink,
};

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
          const label = `${roll?.notation ?? notation} = ${roll?.total ?? "?"}`;
          children.push({
            type: "diceInline",
            children: [{ type: "text", value: label }],
            data: {
              hName: "span",
              hProperties: {
                className: [
                  "dice-inline",
                  roll ? "dice-inline-result" : "dice-inline-pending",
                ],
                role: "note",
                ariaLabel: roll
                  ? `骰子 ${roll.notation}，结果 ${roll.total}`
                  : `骰子 ${notation}，待掷`,
                dataDiceNodeId: nodeId,
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

const COLLAPSE_TRIGGER_VIEWPORT_RATIO = 1.2;

interface CollapsibleMarkdownProps {
  content: string;
  diceRolls?: InlineDiceRoll[];
}

function CollapsibleMarkdown({ content, diceRolls = [] }: CollapsibleMarkdownProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const [tooTall, setTooTall] = useState(false);
  const [expandedContent, setExpandedContent] = useState<string | null>(null);
  const contentId = useId();
  const normalizedContent = sanitizeMilkdownMarkdown(content);
  const expanded = expandedContent === content;

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
        className="prose prose-sm max-w-none dark:prose-invert"
        style={collapsed ? { maxHeight: "80vh", overflow: "hidden" } : undefined}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMilkdownEmptyParagraphs, remarkInlineDice(diceRolls)]}
          components={components}
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
              className="relative z-10 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-sm hover:text-foreground"
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
}

export function MarkdownContent({ content, diceRolls }: MarkdownContentProps) {
  return <CollapsibleMarkdown content={content} diceRolls={diceRolls} />;
}
