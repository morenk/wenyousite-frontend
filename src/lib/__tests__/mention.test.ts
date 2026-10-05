/** 编辑器提及协议测试：稳定路径识别与 DOM 原子标记 */

import fixture from "../../../contracts/markdown-v6-role-mentions-fixtures.json";
import { describe, expect, test } from "vitest";
import {
  getMentionUserId, parseMentionTarget, parseInlineMentionNodes, serializeInlineMentionNode,
  markEditorMentionAnchors,
} from "@/lib/mention";

describe("getMentionUserId", () => {
  test("只识别精确用户路径与 @ 标签", () => {
    expect(getMentionUserId("/users/u_2-abc", "@张三")).toBe("u_2-abc");
    expect(getMentionUserId("/users/u2/followers", "@张三")).toBeNull();
    expect(getMentionUserId("/users/u2", "用户主页")).toBeNull();
    expect(getMentionUserId("https://wenyou.site/users/u2", "@张三")).toBeNull();
  });
});

describe("markEditorMentionAnchors", () => {
  test("把稳定提及链接标记为不可编辑原子内容", () => {
    const root = document.createElement("div");
    root.innerHTML = [
      '<a href="/users/u2">@张三</a>',
      '<a href="/users/u3">用户主页</a>',
      '<a href="/users/u4/followers">@李四</a>',
    ].join("");

    expect(markEditorMentionAnchors(root)).toBe(1);
    const mention = root.querySelector<HTMLAnchorElement>('a[href="/users/u2"]');
    expect(mention).toHaveAttribute("contenteditable", "false");
    expect(mention).toHaveAttribute("spellcheck", "false");
    expect(mention).toHaveAttribute("data-mention-id", "u2");
    expect(root.querySelector('a[href="/users/u3"]')).not.toHaveAttribute(
      "data-mention-id",
    );
    expect(root.querySelector('a[href="/users/u4/followers"]')).not.toHaveAttribute(
      "data-mention-id",
    );

    mention!.textContent = "用户主页";
    expect(markEditorMentionAnchors(root)).toBe(0);
    expect(mention).not.toHaveAttribute("contenteditable");
    expect(mention).not.toHaveAttribute("data-mention-id");
  });
});

describe("Markdown 6 角色源", () => {
  const roleA = "/users/u1?rpIdentityId=c00000000000000000000000a";
  const roleB = "/users/u1?rpIdentityId=c00000000000000000000000b";
  test("同账号同名角色与显式账号是独立目标，往返不丢参数", () => {
    const source = [roleA, roleB, "/users/u1?identityMode=ACCOUNT", "/users/u1"].map((href) => "[@同名](" + href + ")");
    const nodes = parseInlineMentionNodes(source.join(" "));
    expect(nodes.map(serializeInlineMentionNode)).toEqual(source);
    expect(nodes.map((node) => node.type === "mention" ? node.targetIdentityId : null)).toEqual([
      "c00000000000000000000000a", "c00000000000000000000000b", null, undefined,
    ]);
  });
  test("拒绝伪造、重复或混合参数，昵称长度按Unicode码点", () => {
    for (const href of [roleA + "&identityMode=ACCOUNT", roleA + "&rpIdentityId=c00000000000000000000000b", "/users/u1?other=x", "/users/u1?rpIdentityId=invalid"])
      expect(parseMentionTarget(href, "@同名")).toBeNull();
    expect(parseMentionTarget(roleA, "@" + "😀".repeat(24))?.mode).toBe("RP");
    expect(parseMentionTarget(roleA, "@" + "😀".repeat(33))).toBeNull();
  });
  test("同名节点显示投影按sourceHref和原label，DOM装饰不改源", () => {
    const root = document.createElement("div");
    root.innerHTML = [roleA, roleB].map((href) => '<a href="' + href + '"><span data-editor-mention-source>@同名</span></a>').join("");
    markEditorMentionAnchors(root, [
      { userId: "u1", label: "同名", sourceHref: roleA, displayName: "账号", identityId: null },
      { userId: "u1", label: "同名", sourceHref: roleB, displayName: "另一个同名", identityId: "c00000000000000000000000b" },
    ]);
    expect(Array.from(root.querySelectorAll("a")).map((a) => a.dataset.mentionDisplay)).toEqual(["@账号", "@另一个同名"]);
    expect(Array.from(root.querySelectorAll("a")).map((a) => a.textContent)).toEqual(["@同名", "@同名"]);
  });
});

test("消费已提交后端v6语料，不把代码或转义节点识别成提及", () => {
  for (const entry of fixture.cases) {
    const nodes = parseInlineMentionNodes(entry.source).filter((node) => node.type === "mention");
    expect(nodes, entry.id).toHaveLength(entry.expected.length);
    nodes.forEach((node, index) => {
      const target = parseMentionTarget(node.sourceHref ?? "/users/" + node.userId, node.label);
      expect({ userId: target?.userId, label: node.label.slice(1), targetIdentityId: target?.targetIdentityId, mode: target?.mode }, entry.id)
        .toEqual(entry.expected[index]);
    });
  }
  for (const source of fixture.invalidSources) expect(parseInlineMentionNodes(source), source).toEqual([]);
});

test("代码遮蔽优先完整原子标签，Unicode前缀和外层代码保持源边界", () => {
  const href = "/users/u1?rpIdentityId=c00000000000000000000000a";
  const source = "😀[@反`号`](" + href + ") `[@代码](" + href + ")` [@&amp;](" + href + ")";
  expect(parseInlineMentionNodes(source).map((node) => node.label)).toEqual(["@反`号`", "@&amp;"]);
});
