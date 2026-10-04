
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import fixtures from "../../../../contracts/thread-identity.v1.fixtures.json";
import { MarkdownContent } from "../markdown-content";
import { formatMarkdownPreview } from "@/lib/markdown-preview";
import { getMentionUserId, parseInlineMentionNodes } from "@/lib/mention";
import { threadAppearance } from "@/lib/thread-identity";
afterEach(cleanup);
test.each(fixtures.cases)("$id 阅读与摘要使用同一历史提及，权属不变", (item) => {
  render(<MarkdownContent content={item.content} mentionIdentities={item.mentionIdentities} />);
  const links = screen.getAllByRole("link");
  expect(links.map((link) => link.textContent)).toEqual(item.mentionIdentities.map((identity) => "@" + identity.displayName));
  links.forEach((link) => expect(link).toHaveAttribute("href", "/users/u1"));
  const preview = formatMarkdownPreview(item.content, { mentionIdentities: item.mentionIdentities });
  for (const mention of item.mentionIdentities) expect(preview).toContain("@" + mention.displayName);
});
test("24个emoji在阅读、编辑原子识别与搜索摘要中仍为同一个稳定账号", () => {
  const label = "🌙".repeat(24);
  const content = "[@" + label + "](/users/u1)";
  expect(getMentionUserId("/users/u1", "@" + label)).toBe("u1");
  expect(parseInlineMentionNodes(content)).toEqual([{ type: "mention", userId: "u1", label: "@" + label }]);
  const identities = [{ userId: "u1", label, displayName: "小明", identityId: null }];
  render(<MarkdownContent content={content} mentionIdentities={identities} />);
  expect(screen.getByRole("link", { name: "@小明" })).toHaveAttribute("href", "/users/u1");
  expect(formatMarkdownPreview(content, { mentionIdentities: identities })).toContain("@小明");
});
test("关闭功能只投影结构化提及，普通文字与代码保留原名；重开恢复", () => {
  const source = "白鸦 [@白鸦](/users/u1) `[@白鸦](/users/u1)`";
  const identities = [{ userId: "u1", label: "白鸦", displayName: "小明", identityId: null }];
  const view = render(<MarkdownContent content={source} mentionIdentities={identities} />);
  expect(screen.getByRole("link", { name: "@小明" })).toBeInTheDocument();
  expect(document.querySelector("code")).toHaveTextContent("[@白鸦](/users/u1)");
  expect(document.querySelector("p")).toHaveTextContent("白鸦");
  view.rerender(<MarkdownContent content={source} mentionIdentities={[{ ...identities[0]!, displayName: "白鸦", identityId: "rp1" }]} />);
  expect(screen.getByRole("link", { name: "@白鸦" })).toBeInTheDocument();
});
test("作者RP为空走账号，存在历史快照时不改站内字段", () => {
  const account = { id: "u1", username: "小明", avatar: null };
  expect(threadAppearance(account)).toMatchObject({ name: "小明", avatar: null });
  expect(threadAppearance({ ...account, rpIdentity: { id: "rp1", nickname: "白鸦", avatar: null } })).toMatchObject({ name: "白鸦", avatar: null });
  expect(account.username).toBe("小明");
});
