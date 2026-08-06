import { parseDiceNotation } from "@/lib/dice";

export const DICE_INLINE_NODE_NAME = "dice_inline";
export const DICE_INLINE_MARKER_PREFIX = "[[dice:v1:";
export const DICE_INLINE_MARKER_SOURCE =
  String.raw`\[\[dice:v1:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):([^\]\r\n]{1,32})\]\]`;

export interface InlineDiceNode {
  nodeId: string;
  notation: string;
}

export interface InlineDiceRoll extends InlineDiceNode {
  results: number[];
  modifier: number;
  total: number;
}

/** 阅读态和编辑态共用的正式结果文案；多骰展示每一枚原始点数。 */
export function formatInlineDiceRoll(roll: InlineDiceRoll): string {
  if (roll.results.length <= 1 && roll.modifier === 0) {
    return `${roll.notation} = ${roll.total}`;
  }
  const modifier = roll.modifier > 0
    ? ` + ${roll.modifier}`
    : roll.modifier < 0
      ? ` - ${Math.abs(roll.modifier)}`
      : "";
  return `${roll.notation} = [${roll.results.join(", ")}]${modifier} = ${roll.total}`;
}

export function describeInlineDiceRoll(roll: InlineDiceRoll): string {
  const parts = roll.results.join("、");
  const modifier = roll.modifier > 0
    ? `，修正加 ${roll.modifier}`
    : roll.modifier < 0
      ? `，修正减 ${Math.abs(roll.modifier)}`
      : "";
  return `骰子 ${roll.notation}，逐骰结果 ${parts}${modifier}，总计 ${roll.total}`;
}

export function serializeInlineDiceNode(node: InlineDiceNode): string {
  return `[[dice:v1:${node.nodeId}:${node.notation}]]`;
}

/** Milkdown 会转义文本节点开头的 `[[`；只恢复编辑器中真实骰子节点对应的标记。 */
export function restoreSerializedInlineDiceNodes(
  content: string,
  nodes: InlineDiceNode[],
): string {
  return nodes.reduce((markdown, node) => {
    const marker = serializeInlineDiceNode(node);
    const escapedMarker = marker.replace("[[", "\\[\\[");
    return markdown.replaceAll(escapedMarker, marker);
  }, content);
}

export function createInlineDiceNode(notationInput: string): InlineDiceNode | null {
  const parsed = parseDiceNotation(notationInput);
  if (!parsed) return null;
  return { nodeId: crypto.randomUUID(), notation: parsed.notation };
}

function mapInlineDiceNodes(
  content: string,
  render: (node: InlineDiceNode) => string,
): string {
  const markerAtStart = new RegExp(`^${DICE_INLINE_MARKER_SOURCE}`, "iu");
  const lines = content.split("\n");
  let fence: { marker: "`" | "~"; length: number } | null = null;

  return lines
    .map((line) => {
      const fenceToken = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
      if (fence) {
        const closing = /^ {0,3}(`{3,}|~{3,})[\t ]*$/u.exec(line)?.[1];
        if (closing?.[0] === fence.marker && closing.length >= fence.length) fence = null;
        return line;
      }
      if (fenceToken) {
        fence = {
          marker: fenceToken[0] as "`" | "~",
          length: fenceToken.length,
        };
        return line;
      }

      let output = "";
      let index = 0;
      while (index < line.length) {
        if (line[index] === "\\") {
          const escaped = line.slice(index, Math.min(index + 2, line.length));
          output += escaped;
          index += escaped.length;
          continue;
        }

        if (line[index] === "`") {
          let runLength = 1;
          while (line[index + runLength] === "`") runLength++;
          const delimiter = "`".repeat(runLength);
          const closingIndex = line.indexOf(delimiter, index + runLength);
          if (closingIndex >= 0) {
            output += line.slice(index, closingIndex + runLength);
            index = closingIndex + runLength;
            continue;
          }
        }

        if (
          line
            .slice(index, index + DICE_INLINE_MARKER_PREFIX.length)
            .toLowerCase() === DICE_INLINE_MARKER_PREFIX
        ) {
          const match = markerAtStart.exec(line.slice(index));
          if (match) {
            output += render({
              nodeId: match[1]!.toLowerCase(),
              notation: parseDiceNotation(match[2]!)?.notation ?? match[2]!,
            });
            index += match[0].length;
            continue;
          }
        }

        output += line[index];
        index++;
      }
      return output;
    })
    .join("\n");
}

export function parseInlineDiceNodes(content: string): InlineDiceNode[] {
  const nodes: InlineDiceNode[] = [];
  mapInlineDiceNodes(content, (node) => {
    nodes.push(node);
    return "";
  });
  return nodes;
}

export function replaceInlineDiceNodes(
  content: string,
  render: (node: InlineDiceNode) => string,
): string {
  return mapInlineDiceNodes(content, render);
}
