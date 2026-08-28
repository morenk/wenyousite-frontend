/** 恢复严格 CommonMark 因标点/符号邻接而保留为字面的行内格式。 */

type MarkdownPoint = {
  offset?: number;
};

type MarkdownNode = {
  type?: string;
  value?: string;
  children?: MarkdownNode[];
  position?: {
    start?: MarkdownPoint;
    end?: MarkdownPoint;
  };
};

type MarkdownFile = {
  value?: unknown;
};

type MarkerDefinition = {
  marker: "***" | "___" | "**" | "__" | "~~" | "*" | "_";
  createNode: (value: string) => MarkdownNode;
};

type SourceCharacterMap = {
  starts: number[];
  ends: number[];
};

const PROTECTED_NODE_TYPES = new Set([
  "code",
  "definition",
  "footnoteDefinition",
  "footnoteReference",
  "html",
  "image",
  "imageReference",
  "inlineCode",
  "link",
  "linkReference",
]);

const MARKER_DEFINITIONS: readonly MarkerDefinition[] = [
  {
    marker: "***",
    createNode: (value) => ({
      type: "emphasis",
      children: [{
        type: "strong",
        children: [{ type: "text", value }],
      }],
    }),
  },
  {
    marker: "___",
    createNode: (value) => ({
      type: "emphasis",
      children: [{
        type: "strong",
        children: [{ type: "text", value }],
      }],
    }),
  },
  {
    marker: "**",
    createNode: (value) => ({
      type: "strong",
      children: [{ type: "text", value }],
    }),
  },
  {
    marker: "__",
    createNode: (value) => ({
      type: "strong",
      children: [{ type: "text", value }],
    }),
  },
  {
    marker: "~~",
    createNode: (value) => ({
      type: "delete",
      children: [{ type: "text", value }],
    }),
  },
  {
    marker: "*",
    createNode: (value) => ({
      type: "emphasis",
      children: [{ type: "text", value }],
    }),
  },
  {
    marker: "_",
    createNode: (value) => ({
      type: "emphasis",
      children: [{ type: "text", value }],
    }),
  },
];

const MARKER_BY_VALUE = new Map(
  MARKER_DEFINITIONS.map((definition) => [definition.marker, definition]),
);
const ASCII_PUNCTUATION_RE = /[!-/:-@[-`{-~]/u;
const UNICODE_PUNCTUATION_OR_SYMBOL_RE = /[\p{P}\p{S}]/u;
const UNICODE_WHITESPACE_RE = /[\s\p{Z}]/u;

function decodeCharacterReference(
  source: string,
  index: number,
): { value: string; end: number } | null {
  const match = /^&(?:#(?:[xX]([\dA-Fa-f]+)|(\d+))|(amp|apos|gt|lt|quot));/u.exec(
    source.slice(index),
  );
  if (!match) return null;

  let value: string | undefined;
  if (match[1] || match[2]) {
    const codePoint = Number.parseInt(match[1] ?? match[2]!, match[1] ? 16 : 10);
    if (codePoint >= 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      value = String.fromCodePoint(codePoint);
    }
  } else {
    value = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      quot: '"',
    }[match[3]!];
  }
  return value === undefined ? null : { value, end: index + match[0].length };
}

/** 将 mdast 解码后的 text 下标映射回其原始源码字符，专门用于验证定界符。 */
function createSourceCharacterMap(raw: string, value: string): SourceCharacterMap | null {
  const starts = new Array<number>(value.length);
  const ends = new Array<number>(value.length);
  let rawIndex = 0;
  let valueIndex = 0;

  while (rawIndex < raw.length && valueIndex < value.length) {
    const escaped = raw[rawIndex] === "\\"
      && rawIndex + 1 < raw.length
      && ASCII_PUNCTUATION_RE.test(raw[rawIndex + 1]!);
    if (escaped && value[valueIndex] === raw[rawIndex + 1]) {
      starts[valueIndex] = rawIndex + 1;
      ends[valueIndex] = rawIndex + 2;
      rawIndex += 2;
      valueIndex += 1;
      continue;
    }

    if (raw[rawIndex] === "&") {
      const reference = decodeCharacterReference(raw, rawIndex);
      if (reference && value.startsWith(reference.value, valueIndex)) {
        for (let offset = 0; offset < reference.value.length; offset++) {
          starts[valueIndex + offset] = rawIndex;
          ends[valueIndex + offset] = reference.end;
        }
        rawIndex = reference.end;
        valueIndex += reference.value.length;
        continue;
      }
    }

    if (raw[rawIndex] !== value[valueIndex]) return null;
    starts[valueIndex] = rawIndex;
    ends[valueIndex] = rawIndex + 1;
    rawIndex += 1;
    valueIndex += 1;
  }

  return rawIndex === raw.length && valueIndex === value.length
    ? { starts, ends }
    : null;
}

function markerAt(value: string, index: number): MarkerDefinition | null {
  const markerCharacter = value[index];
  if (markerCharacter !== "*" && markerCharacter !== "_" && markerCharacter !== "~") {
    return null;
  }
  if (index > 0 && value[index - 1] === markerCharacter) return null;

  let runLength = 1;
  while (value[index + runLength] === markerCharacter) runLength += 1;
  return MARKER_BY_VALUE.get(markerCharacter.repeat(runLength) as MarkerDefinition["marker"])
    ?? null;
}

function findClosingMarker(value: string, marker: string, start: number): number {
  const markerCharacter = marker[0]!;
  let index = value.indexOf(marker, start);
  while (index >= 0) {
    if (
      value[index - 1] !== markerCharacter
      && value[index + marker.length] !== markerCharacter
    ) {
      return index;
    }
    index = value.indexOf(marker, index + marker.length);
  }
  return -1;
}

function firstCodePoint(value: string): string {
  return Array.from(value)[0] ?? "";
}

function lastCodePoint(value: string): string {
  return Array.from(value).at(-1) ?? "";
}

function hasRecoverableInnerBoundary(value: string): boolean {
  if (!value) return false;
  const first = firstCodePoint(value);
  const last = lastCodePoint(value);
  if (UNICODE_WHITESPACE_RE.test(first) || UNICODE_WHITESPACE_RE.test(last)) return false;
  return UNICODE_PUNCTUATION_OR_SYMBOL_RE.test(first)
    || UNICODE_PUNCTUATION_OR_SYMBOL_RE.test(last);
}

function isEscapedAt(source: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor--) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function hasLiteralUnescapedMarkers(
  source: string,
  nodeStart: number,
  raw: string,
  sourceMap: SourceCharacterMap,
  valueStart: number,
  valueEnd: number,
  marker: string,
): boolean {
  const openingStart = sourceMap.starts[valueStart];
  const openingEnd = sourceMap.ends[valueStart + marker.length - 1];
  const closingStart = sourceMap.starts[valueEnd - marker.length];
  const closingEnd = sourceMap.ends[valueEnd - 1];
  if (
    openingStart === undefined
    || openingEnd === undefined
    || closingStart === undefined
    || closingEnd === undefined
  ) {
    return false;
  }
  return raw.slice(openingStart, openingEnd) === marker
    && raw.slice(closingStart, closingEnd) === marker
    && !isEscapedAt(source, nodeStart + openingStart)
    && !isEscapedAt(source, nodeStart + closingStart);
}

function recoverTextNode(node: MarkdownNode, source: string): MarkdownNode[] | null {
  const value = node.value;
  const nodeStart = node.position?.start?.offset;
  const nodeEnd = node.position?.end?.offset;
  if (
    typeof value !== "string"
    || typeof nodeStart !== "number"
    || typeof nodeEnd !== "number"
    || nodeStart < 0
    || nodeEnd < nodeStart
  ) {
    return null;
  }

  const raw = source.slice(nodeStart, nodeEnd);
  const sourceMap = createSourceCharacterMap(raw, value);
  if (!sourceMap) return null;

  const children: MarkdownNode[] = [];
  let unchangedStart = 0;
  let index = 0;
  let changed = false;

  while (index < value.length) {
    const definition = markerAt(value, index);
    if (!definition) {
      index += 1;
      continue;
    }

    const closingIndex = findClosingMarker(
      value,
      definition.marker,
      index + definition.marker.length,
    );
    if (closingIndex < 0) {
      index += definition.marker.length;
      continue;
    }

    const end = closingIndex + definition.marker.length;
    const inner = value.slice(index + definition.marker.length, closingIndex);
    const recoverable = hasRecoverableInnerBoundary(inner)
      && hasLiteralUnescapedMarkers(
        source,
        nodeStart,
        raw,
        sourceMap,
        index,
        end,
        definition.marker,
      );
    if (!recoverable) {
      index = end;
      continue;
    }

    if (index > unchangedStart) {
      children.push({ type: "text", value: value.slice(unchangedStart, index) });
    }
    children.push(definition.createNode(inner));
    changed = true;
    unchangedStart = end;
    index = end;
  }

  if (!changed) return null;
  if (unchangedStart < value.length) {
    children.push({ type: "text", value: value.slice(unchangedStart) });
  }
  return children;
}

function transformNode(node: MarkdownNode, source: string) {
  if (!node.children || PROTECTED_NODE_TYPES.has(node.type ?? "")) return;

  const children: MarkdownNode[] = [];
  for (const child of node.children) {
    if (child.type === "text") {
      children.push(...(recoverTextNode(child, source) ?? [child]));
    } else {
      transformNode(child, source);
      children.push(child);
    }
  }
  node.children = children;
}

/**
 * 只恢复解析器留在 text 节点中的边界歧义；代码、链接、图片、转义与普通词内下划线不变。
 */
export function remarkRecoverAttentionBoundaries() {
  return (tree: MarkdownNode, file: MarkdownFile) => {
    if (typeof file.value !== "string") return;
    transformNode(tree, file.value);
  };
}
