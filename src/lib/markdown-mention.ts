import { parseMentionTarget } from "@/lib/mention";

type MentionMarkdownNode = {
  type?: string;
  url?: string;
  children?: MentionMarkdownNode[];
  value?: string;
  position?: { start?: { offset?: number }; end?: { offset?: number } };
};

/** v6 标签是昵称原文；外层格式照常解析，标签内的 *、反引号及实体保持字面。 */
export function remarkCanonicalMentions() {
  return (tree: MentionMarkdownNode, file: { value?: unknown }) => {
    const source = String(file.value ?? "");
    const visit = (node: MentionMarkdownNode) => {
      if (node.type === "link" && node.position?.start?.offset !== undefined && node.position.end?.offset !== undefined) {
        const raw = source.slice(node.position.start.offset, node.position.end.offset);
        const match = /^\[(@[^\]\r\n]{1,32})\]\((\/users\/[^)\r\n]+)\)$/u.exec(raw);
        const target = match ? parseMentionTarget(match[2], match[1]) : null;
        if (target && target.mode !== "LEGACY") {
          node.children = [{ type: "text", value: match![1]! }];
          return;
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
