import { $nodeSchema, $prose, $remark } from "@milkdown/kit/utils";
import { Fragment, Slice, type Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin } from "@milkdown/kit/prose/state";
import {
  DICE_INLINE_MARKER_SOURCE,
  DICE_INLINE_NODE_NAME,
  serializeInlineDiceNode,
  type InlineDiceRoll,
} from "@/lib/dice-inline";

type MarkdownNode = {
  type: string;
  value?: string;
  nodeId?: string;
  notation?: string;
  children?: MarkdownNode[];
};

function transformMarkdownTextNodes(node: MarkdownNode) {
  if (!node.children) return;
  const matcher = new RegExp(DICE_INLINE_MARKER_SOURCE, "giu");
  const children: MarkdownNode[] = [];

  for (const child of node.children) {
    if (child.type !== "text" || !child.value) {
      transformMarkdownTextNodes(child);
      children.push(child);
      continue;
    }

    let lastIndex = 0;
    for (const match of child.value.matchAll(matcher)) {
      if (match.index > lastIndex) {
        children.push({ type: "text", value: child.value.slice(lastIndex, match.index) });
      }
      children.push({
        type: "diceInline",
        nodeId: match[1]!.toLowerCase(),
        notation: match[2]!,
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
}

function mapPastedFragment(
  fragment: Fragment,
  movedNodeIds: Set<string>,
): Fragment {
  const children: ProseNode[] = [];
  fragment.forEach((node) => {
    if (node.type.name === DICE_INLINE_NODE_NAME) {
      const oldNodeId = String(node.attrs.nodeId);
      const nodeId = movedNodeIds.has(oldNodeId) ? oldNodeId : crypto.randomUUID();
      children.push(node.type.create({ ...node.attrs, nodeId }, null, node.marks));
      return;
    }
    children.push(node.content.size > 0 ? node.copy(mapPastedFragment(node.content, movedNodeIds)) : node);
  });
  return Fragment.fromArray(children);
}

export function createDiceInlineEditorPlugins(rolls: InlineDiceRoll[] = []) {
  const rollsByNodeId = new Map(rolls.map((roll) => [roll.nodeId, roll]));
  const movedNodeIds = new Set<string>();

  const remarkDiceInline = $remark("dice-inline-remark", () => () => (tree: MarkdownNode) => {
    transformMarkdownTextNodes(tree);
  });

  const diceInlineSchema = $nodeSchema(DICE_INLINE_NODE_NAME, () => ({
    group: "inline",
    inline: true,
    atom: true,
    draggable: true,
    selectable: true,
    attrs: {
      nodeId: { default: "" },
      notation: { default: "1d20" },
    },
    parseDOM: [
      {
        tag: `span[data-type="${DICE_INLINE_NODE_NAME}"]`,
        getAttrs: (dom: HTMLElement) => ({
          nodeId: dom.dataset.nodeId ?? "",
          notation: dom.dataset.notation ?? "1d20",
        }),
      },
    ],
    toDOM: (node: ProseNode) => {
      const nodeId = String(node.attrs.nodeId);
      const notation = String(node.attrs.notation);
      const roll = rollsByNodeId.get(nodeId);
      const dom = document.createElement("span");
      dom.dataset.type = DICE_INLINE_NODE_NAME;
      dom.dataset.nodeId = nodeId;
      dom.dataset.notation = notation;
      dom.className = roll ? "dice-inline dice-inline-result" : "dice-inline dice-inline-pending";
      dom.contentEditable = "false";
      dom.setAttribute("role", "note");
      dom.setAttribute(
        "aria-label",
        roll ? `骰子 ${roll.notation}，结果 ${roll.total}` : `骰子 ${notation}，待掷`,
      );
      dom.textContent = `${roll?.notation ?? notation} = ${roll?.total ?? "?"}`;
      return dom;
    },
    parseMarkdown: {
      match: (node: MarkdownNode) => node.type === "diceInline",
      runner: (state, node: MarkdownNode, type) => {
        state.addNode(type, { nodeId: node.nodeId, notation: node.notation });
      },
    },
    toMarkdown: {
      match: (node: ProseNode) => node.type.name === DICE_INLINE_NODE_NAME,
      runner: (state, node: ProseNode) => {
        state.addNode(
          "text",
          undefined,
          serializeInlineDiceNode({
            nodeId: String(node.attrs.nodeId),
            notation: String(node.attrs.notation),
          }),
        );
      },
    },
  }));

  const clonePastedDice = $prose(
    () =>
      new Plugin({
        props: {
          handleDOMEvents: {
            cut: (view) => {
              movedNodeIds.clear();
              view.state.selection.content().content.descendants((node) => {
                if (node.type.name === DICE_INLINE_NODE_NAME) {
                  movedNodeIds.add(String(node.attrs.nodeId));
                }
              });
              return false;
            },
          },
          transformPasted: (slice) => {
            const transformed = new Slice(
              mapPastedFragment(slice.content, movedNodeIds),
              slice.openStart,
              slice.openEnd,
            );
            movedNodeIds.clear();
            return transformed;
          },
        },
      }),
  );

  return { remarkDiceInline, diceInlineSchema, clonePastedDice };
}
