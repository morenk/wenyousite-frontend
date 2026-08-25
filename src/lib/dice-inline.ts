import { parseDiceNotation } from "@/lib/dice";
import { INLINE_ELEMENT_STYLES } from "@wenyousite/foundation/elements";

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

const DICE_PRESENTATION = INLINE_ELEMENT_STYLES.dice;

const DICE_DETAIL = DICE_PRESENTATION.detail;

export const DICE_DETAIL_PRESENTATION = {
  title: DICE_DETAIL.title,
  resultsLabel: DICE_DETAIL.resultsLabel,
  resultIndexOrigin: DICE_DETAIL.resultIndexOrigin,
  resultItem: DICE_PRESENTATION.semantics.resultItem,
  subtotalLabel: DICE_DETAIL.calculation.subtotalLabel,
  modifierLabel: DICE_DETAIL.calculation.modifierLabel,
  totalLabel: DICE_DETAIL.calculation.totalLabel,
  positiveModifier: DICE_DETAIL.calculation.positiveModifier,
  negativeModifier: DICE_DETAIL.calculation.negativeModifier,
} as const;

export const DICE_INSERTION_PRESENTATION = DICE_PRESENTATION.editor.insertion;

/** 阅读态和编辑态共用的紧凑正式结果文案；逐骰明细进入交互详情。 */
export function formatInlineDiceRoll(roll: InlineDiceRoll): string {
  return DICE_PRESENTATION.labels.settled
    .replace("{notation}", roll.notation)
    .replace("{total}", String(roll.total));
}

export function formatInlineDicePending(notation: string): string {
  return DICE_PRESENTATION.labels.pending.replace("{notation}", notation);
}

export function describeInlineDiceRoll(roll: InlineDiceRoll): string {
  return DICE_PRESENTATION.semantics.settled
    .replace("{notation}", roll.notation)
    .replace("{total}", String(roll.total));
}

export function describeInlineDiceResultItem(index: number, value: number): string {
  return DICE_DETAIL_PRESENTATION.resultItem
    .replace("{index}", String(index))
    .replace("{value}", String(value));
}

export function formatInlineDiceModifier(modifier: number): string {
  return modifier > 0
    ? DICE_DETAIL_PRESENTATION.positiveModifier.replace("{modifier}", String(modifier))
    : DICE_DETAIL_PRESENTATION.negativeModifier.replace(
        "{absoluteModifier}",
        String(Math.abs(modifier)),
      );
}

export function describeInlineDicePending(notation: string): string {
  return DICE_PRESENTATION.semantics.pending.replace("{notation}", notation);
}

export function serializeInlineDiceNode(node: InlineDiceNode): string {
  return `[[dice:v1:${node.nodeId}:${node.notation}]]`;
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
