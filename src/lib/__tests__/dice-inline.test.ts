import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createInlineDiceNode,
  describeInlineDiceRoll,
  formatInlineDiceRoll,
  parseInlineDiceNodes,
  replaceInlineDiceNodes,
  restoreSerializedInlineDiceNodes,
  serializeInlineDiceNode,
} from "@/lib/dice-inline";

const NODE_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("dice-inline", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => NODE_ID) });
  });

  test("创建节点时规范化表达式并生成稳定 nodeId", () => {
    expect(createInlineDiceNode(" D20 ")).toEqual({
      nodeId: NODE_ID,
      notation: "1d20",
    });
  });

  test("序列化后可从混排正文中恢复节点", () => {
    const marker = serializeInlineDiceNode({ nodeId: NODE_ID, notation: "2d6+3" });
    expect(parseInlineDiceNodes(`攻击 ${marker} 点伤害`)).toEqual([
      { nodeId: NODE_ID, notation: "2d6+3" },
    ]);
  });

  test("替换节点时保留前后普通文字", () => {
    const marker = serializeInlineDiceNode({ nodeId: NODE_ID, notation: "1d20" });
    expect(
      replaceInlineDiceNodes(`前 ${marker} 后`, (node) => `${node.notation} = ?`),
    ).toBe("前 1d20 = ? 后");
  });

  test("计数和预览不会把代码或转义文本误认为骰子节点", () => {
    const marker = serializeInlineDiceNode({ nodeId: NODE_ID, notation: "1d20" });
    const content = `正文 ${marker}\n\`${marker}\`\n\\${marker}\n\`\`\`\n${marker}\n\`\`\``;

    expect(parseInlineDiceNodes(content)).toEqual([
      { nodeId: NODE_ID, notation: "1d20" },
    ]);
    expect(replaceInlineDiceNodes(content, () => "骰子")).toBe(
      `正文 骰子\n\`${marker}\`\n\\${marker}\n\`\`\`\n${marker}\n\`\`\``,
    );
  });

  test("读取大小写不同的节点并规范化表达式", () => {
    const uppercase = `[[DICE:V1:${NODE_ID.toUpperCase()}:D20]]`;
    expect(parseInlineDiceNodes(uppercase)).toEqual([
      { nodeId: NODE_ID, notation: "1d20" },
    ]);
  });

  test("不接受无效骰子表达式", () => {
    expect(createInlineDiceNode("101d1000")).toBeNull();
  });

  test("只恢复编辑器真实骰子节点被 Milkdown 转义的协议标记", () => {
    const node = { nodeId: NODE_ID, notation: "1d100" };
    const escaped = `正文 \\[\\[dice:v1:${NODE_ID}:1d100]]`;
    const unknown = "\\[\\[dice:v1:550e8400-e29b-41d4-a716-446655440099:1d20]]";

    expect(restoreSerializedInlineDiceNodes(`${escaped} ${unknown}`, [node])).toBe(
      `正文 ${serializeInlineDiceNode(node)} ${unknown}`,
    );
  });

  test("可见文案只显示总计，完整语义保留逐骰结果和修正值", () => {
    expect(formatInlineDiceRoll({
      nodeId: NODE_ID,
      notation: "2d50",
      results: [33, 48],
      modifier: 0,
      total: 81,
    })).toBe("2d50 = 81");
    expect(formatInlineDiceRoll({
      nodeId: NODE_ID,
      notation: "2d6+3",
      results: [2, 5],
      modifier: 3,
      total: 10,
    })).toBe("2d6+3 = 10");
    expect(describeInlineDiceRoll({
      nodeId: NODE_ID,
      notation: "2d6-3",
      results: [2, 5],
      modifier: -3,
      total: 4,
    })).toBe("骰子 2d6-3，逐骰结果 2、5，修正减 3，总计 4");
  });
});
