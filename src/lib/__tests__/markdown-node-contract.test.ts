import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { resolvePastedDiceNodeId } from "@/components/editor/dice-inline-plugin";
import {
  parseInlineDiceNodes,
  serializeInlineDiceNode,
  type InlineDiceNode,
} from "@/lib/dice-inline";
import {
  parseInlineMentionNodes,
  serializeInlineMentionNode,
  type InlineMentionNode,
} from "@/lib/mention";
import {
  parseMarkdownImageNodes,
  serializeMarkdownImageNode,
  type MarkdownImageNode,
} from "@/lib/sticker-inline";

type ContractNode =
  | ({ type: "dice" } & InlineDiceNode)
  | InlineMentionNode
  | MarkdownImageNode;

interface NodeFixture {
  id: string;
  markdown: string;
  nodes: ContractNode[];
  serialized: string;
}

interface IdentityRule {
  nodeType: string;
  operation: string;
  field: string | null;
  result: string;
}

const fixtures = JSON.parse(
  readFileSync(resolve(process.cwd(), "contracts/markdown-v4-nodes-fixtures.json"), "utf8"),
) as { cases: NodeFixture[]; identityRules: IdentityRule[] };

describe("Markdown v4 节点跨端契约", () => {
  test.each(fixtures.cases)("$id 解析与节点序列化一致", (fixture) => {
    const mentions = fixture.nodes.filter(
      (node): node is InlineMentionNode =>
        node.type === "mention" || node.type === "mention_all_players",
    );
    const dice = fixture.nodes
      .filter((node): node is Extract<ContractNode, { type: "dice" }> => node.type === "dice")
      .map(({ nodeId, notation }) => ({ nodeId, notation }));
    const images = fixture.nodes.filter(
      (node): node is MarkdownImageNode => node.type === "image" || node.type === "sticker",
    );

    expect(parseInlineMentionNodes(fixture.markdown)).toEqual(mentions);
    expect(parseInlineDiceNodes(fixture.markdown)).toEqual(dice);
    expect(parseMarkdownImageNodes(fixture.markdown)).toEqual(images);

    for (const node of mentions) {
      expect(fixture.serialized).toContain(serializeInlineMentionNode(node));
    }
    for (const node of dice) {
      expect(fixture.serialized).toContain(serializeInlineDiceNode(node));
    }
    for (const node of images) {
      expect(fixture.serialized).toContain(serializeMarkdownImageNode(node));
    }
  });

  test("骰子复制生成新 nodeId，剪切粘贴保留 nodeId", () => {
    const oldId = "550e8400-e29b-41d4-a716-446655440000";
    const newId = "550e8400-e29b-41d4-a716-446655440001";
    expect(resolvePastedDiceNodeId(oldId, new Set(), () => newId)).toBe(newId);
    expect(resolvePastedDiceNodeId(oldId, new Set([oldId]), () => newId)).toBe(oldId);
    expect(fixtures.identityRules).toEqual(expect.arrayContaining([
      { nodeType: "dice", operation: "copy_paste", field: "nodeId", result: "regenerate" },
      { nodeType: "dice", operation: "cut_paste", field: "nodeId", result: "preserve" },
      { nodeType: "mention", operation: "copy_paste", field: "userId", result: "preserve" },
      { nodeType: "sticker", operation: "copy_paste", field: "assetId", result: "preserve" },
    ]));
  });
});
