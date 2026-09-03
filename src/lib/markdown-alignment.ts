/** Markdown 顶层正文对齐协议；存储标记与 DOM 属性都只接受受控枚举。 */

import {
  ACTIVE_MARKDOWN_CONTRACT_VERSION,
  IMAGE_ALIGNMENT_MARKDOWN_CONTRACT_VERSION,
} from "@/lib/markdown";

export const WENYOU_ALIGNMENT_ATTRIBUTE = "data-wenyou-align";

export type WenyouTextAlignment = "left" | "center" | "right";
export type StoredWenyouTextAlignment = Exclude<WenyouTextAlignment, "left">;

type MarkdownPosition = {
  start?: { line?: number };
  end?: { line?: number };
};

export type AlignmentMarkdownNode = {
  type?: string;
  identifier?: unknown;
  label?: unknown;
  url?: unknown;
  alt?: unknown;
  title?: unknown;
  depth?: unknown;
  data?: Record<string, unknown>;
  position?: MarkdownPosition;
  children?: AlignmentMarkdownNode[];
};

const ALIGNMENT_IDENTIFIER_RE = /^wenyousite-align-v1-(center|right)$/u;
export interface MarkdownAlignmentOptions extends Record<string, unknown> {
  markdownContractVersion?: number;
}

export function isStoredWenyouTextAlignment(
  value: unknown,
): value is StoredWenyouTextAlignment {
  return value === "center" || value === "right";
}

export function alignmentLabel(alignment: WenyouTextAlignment): string {
  switch (alignment) {
    case "center":
      return "居中对齐";
    case "right":
      return "右对齐";
    default:
      return "左对齐";
  }
}

function getMarkerAlignment(node: AlignmentMarkdownNode): StoredWenyouTextAlignment | null {
  if (node.type !== "definition" || node.url !== "#" || node.title != null) return null;
  const identifier = typeof node.identifier === "string"
    ? node.identifier
    : typeof node.label === "string"
      ? node.label
      : "";
  const alignment = identifier.match(ALIGNMENT_IDENTIFIER_RE)?.[1];
  return isStoredWenyouTextAlignment(alignment) ? alignment : null;
}

function isEligibleTarget(
  node: AlignmentMarkdownNode,
  imageAlignmentEnabled: boolean,
): boolean {
  if (node.type === "image-block") return imageAlignmentEnabled;
  if (node.type === "heading") return node.depth === 2 || node.depth === 3;
  if (node.type !== "paragraph") return false;

  const regularImages = (node.children ?? []).filter(
    (child) =>
      child.type === "image" &&
      !String(child.title ?? "").startsWith("wenyousite-sticker:v1:"),
  );
  return regularImages.length === 0
    || (imageAlignmentEnabled && node.children?.length === 1 && regularImages.length === 1);
}

function isAdjacent(
  marker: AlignmentMarkdownNode,
  target: AlignmentMarkdownNode,
): boolean {
  const markerLine = marker.position?.end?.line;
  const targetLine = target.position?.start?.line;
  return markerLine === undefined || targetLine === undefined || targetLine === markerLine + 1;
}

/**
 * 把隐藏的 CommonMark reference definition 绑定到紧随其后的顶层正文块。
 * 输入已先经过 Markdown v4/v5 校验；这里仍做邻接与节点类型防御检查。
 */
export function remarkWenyouAlignment(options: MarkdownAlignmentOptions = {}) {
  const markdownContractVersion =
    options.markdownContractVersion ?? ACTIVE_MARKDOWN_CONTRACT_VERSION;
  const imageAlignmentEnabled =
    markdownContractVersion >= IMAGE_ALIGNMENT_MARKDOWN_CONTRACT_VERSION;
  return (treeValue: unknown) => {
    const tree = treeValue as AlignmentMarkdownNode;
    if (tree.type !== "root" || !tree.children) return;
    const output: AlignmentMarkdownNode[] = [];

    for (let index = 0; index < tree.children.length; index++) {
      const marker = tree.children[index]!;
      const alignment = getMarkerAlignment(marker);
      const target = tree.children[index + 1];
      if (
        !alignment ||
        !target ||
        !isEligibleTarget(target, imageAlignmentEnabled) ||
        !isAdjacent(marker, target)
      ) {
        output.push(marker);
        continue;
      }

      target.data = {
        ...target.data,
        wenyouAlign: alignment,
        hProperties: {
          ...(typeof target.data?.hProperties === "object" && target.data.hProperties
            ? target.data.hProperties as Record<string, unknown>
            : {}),
          [WENYOU_ALIGNMENT_ATTRIBUTE]: alignment,
        },
      };
      output.push(target);
      index++;
    }

    tree.children = output;
  };
}

/** remark-stringify 会在 definition 与正文块间插空行；协议要求两行严格相邻。 */
export function normalizeSerializedAlignmentMarkers(markdown: string): string {
  return markdown.replace(
    /^(\[wenyousite-align-v1-(?:center|right)\]: #)\n+(?=[^\r\n])/gmu,
    "$1\n",
  );
}
