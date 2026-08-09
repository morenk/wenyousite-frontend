import { Fragment, Schema, Slice, type Node as ProseNode } from "@milkdown/kit/prose/model";
import { describe, expect, test } from "vitest";
import {
  allowsUnorderedListTransaction,
  containsUnorderedList,
  countUnorderedLists,
  flattenUnorderedListSlice,
} from "@/components/editor/unordered-list-guard-plugin";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    blockquote: { content: "block+", group: "block" },
    bullet_list: { content: "list_item+", group: "block" },
    ordered_list: {
      content: "list_item+",
      group: "block",
      attrs: { order: { default: 1 } },
    },
    list_item: { content: "paragraph block*" },
    text: { group: "inline" },
  },
  marks: {
    strong: {},
  },
});

const text = (value: string, strong = false) => schema.text(
  value,
  strong ? [schema.marks.strong.create()] : undefined,
);
const paragraph = (value: string, strong = false) => schema.node(
  "paragraph",
  null,
  [text(value, strong)],
);
const listItem = (...content: ProseNode[]) => schema.node("list_item", null, content);
const bulletList = (...items: ProseNode[]) => schema.node("bullet_list", null, items);
const orderedList = (...items: ProseNode[]) => schema.node("ordered_list", null, items);
const doc = (...content: ProseNode[]) => schema.node("doc", null, content);

describe("Milkdown 无序列表创建保护", () => {
  test("粘贴时递归拆除无序与任务列表并保留段落 marks 和有序列表", () => {
    const source = doc(
      paragraph("开头"),
      bulletList(
        listItem(
          paragraph("第一项", true),
          bulletList(listItem(paragraph("嵌套项"))),
          orderedList(listItem(paragraph("保留有序项"))),
        ),
        listItem(paragraph("第二项")),
      ),
    );

    const flattened = flattenUnorderedListSlice(Slice.maxOpen(source.content));
    const normalized = doc(...flattened.content.content);

    expect(containsUnorderedList(flattened.content)).toBe(false);
    expect(normalized.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "开头" }] },
        {
          type: "paragraph",
          content: [{ type: "text", marks: [{ type: "strong" }], text: "第一项" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "嵌套项" }] },
        {
          type: "ordered_list",
          attrs: { order: 1 },
          content: [{
            type: "list_item",
            content: [{
              type: "paragraph",
              content: [{ type: "text", text: "保留有序项" }],
            }],
          }],
        },
        { type: "paragraph", content: [{ type: "text", text: "第二项" }] },
      ],
    });
  });

  test("没有无序列表的粘贴片段保持原对象", () => {
    const slice = new Slice(Fragment.from(paragraph("普通正文")), 0, 0);
    expect(flattenUnorderedListSlice(slice)).toBe(slice);
  });

  test("事务允许编辑或减少历史列表，但拒绝增加列表容器", () => {
    const oldDoc = doc(bulletList(listItem(paragraph("历史项"))));
    const editedDoc = doc(bulletList(listItem(paragraph("修改后的历史项"))));
    const removedDoc = doc(paragraph("普通段落"));
    const addedDoc = doc(
      bulletList(listItem(paragraph("历史项"))),
      bulletList(listItem(paragraph("新列表"))),
    );

    expect(countUnorderedLists(oldDoc)).toBe(1);
    expect(allowsUnorderedListTransaction({ doc: oldDoc }, editedDoc)).toBe(true);
    expect(allowsUnorderedListTransaction({ doc: oldDoc }, removedDoc)).toBe(true);
    expect(allowsUnorderedListTransaction({ doc: oldDoc }, addedDoc)).toBe(false);
  });
});
