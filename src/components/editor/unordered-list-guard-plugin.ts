import {
  editorViewOptionsCtx,
  parserCtx,
  type Editor,
} from "@milkdown/core";
import {
  bulletListKeymap,
  wrapInBulletListInputRule,
} from "@milkdown/kit/preset/commonmark";
import {
  Fragment,
  Slice,
  type Node as ProseNode,
} from "@milkdown/kit/prose/model";
import { Plugin, type EditorState } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

const BULLET_LIST_NODE_NAME = "bullet_list";

/** 判断一个文档片段中是否包含无序（含任务）列表。 */
export function containsUnorderedList(node: ProseNode | Fragment): boolean {
  let found = false;
  node.descendants((child) => {
    if (child.type.name === BULLET_LIST_NODE_NAME) {
      found = true;
      return false;
    }
    return !found;
  });
  return found;
}

/** 统计列表容器，用于阻止绕过入口创建的新列表，同时允许编辑历史列表。 */
export function countUnorderedLists(node: ProseNode): number {
  let count = 0;
  node.descendants((child) => {
    if (child.type.name === BULLET_LIST_NODE_NAME) count += 1;
  });
  return count;
}

function flattenNode(node: ProseNode): ProseNode[] {
  if (node.type.name === BULLET_LIST_NODE_NAME) {
    const blocks: ProseNode[] = [];
    node.forEach((listItem) => {
      listItem.forEach((child) => {
        blocks.push(...flattenNode(child));
      });
    });
    return blocks;
  }

  if (node.isLeaf) return [node];

  const content = flattenUnorderedListFragment(node.content);
  if (!node.type.validContent(content)) return [node];
  return [node.copy(content)];
}

/**
 * 将粘贴片段中的无序列表与列表项拆为普通块。
 * 有序列表、行内 marks 与非列表块保持原有结构。
 */
export function flattenUnorderedListFragment(fragment: Fragment): Fragment {
  const children: ProseNode[] = [];
  fragment.forEach((node) => children.push(...flattenNode(node)));
  return Fragment.fromArray(children);
}

export function flattenUnorderedListSlice(slice: Slice): Slice {
  if (!containsUnorderedList(slice.content)) return slice;
  return Slice.maxOpen(flattenUnorderedListFragment(slice.content));
}

function applyPluginPasteTransforms(view: EditorView, slice: Slice): Slice {
  return view.state.plugins.reduce((current, plugin) => {
    const transform = plugin.props.transformPasted;
    return transform ? transform.call(plugin, current, view, true) : current;
  }, slice);
}

function parsePlainTextSlice(view: EditorView, text: string, parse: (value: string) => ProseNode) {
  const parsed = parse(text);
  return applyPluginPasteTransforms(view, Slice.maxOpen(parsed.content));
}

function dispatchFlattenedPaste(view: EditorView, slice: Slice): boolean {
  const flattened = flattenUnorderedListSlice(slice);
  view.dispatch(view.state.tr.replaceSelection(flattened).scrollIntoView());
  return true;
}

/** 新列表容器数不得超过事务前；初始历史文档不经过此事务。 */
export function allowsUnorderedListTransaction(
  state: Pick<EditorState, "doc">,
  nextDoc: ProseNode,
): boolean {
  return countUnorderedLists(nextDoc) <= countUnorderedLists(state.doc);
}

const preventNewUnorderedListTransactions = $prose(
  () => new Plugin({
    filterTransaction: (transaction, state) => (
      !transaction.docChanged || allowsUnorderedListTransaction(state, transaction.doc)
    ),
  }),
);

/**
 * 关闭无序列表的全部新建入口，但保留 schema 与节点视图以兼容历史正文。
 */
export function configureNoNewUnorderedLists(editor: Editor): void {
  // Editor.remove 在 Idle 状态会同步移出待加载插件；Promise 仅统一 Created 状态的清理接口。
  void editor.remove([wrapInBulletListInputRule, ...bulletListKeymap]);

  editor
    .config((ctx) => {
      ctx.update(editorViewOptionsCtx, (previous) => {
        const previousHandlePaste = previous.handlePaste;
        return {
          ...previous,
          handlePaste: (view, event, preProcessedSlice) => {
            const clipboard = event.clipboardData;
            if (!clipboard) {
              return previousHandlePaste?.(view, event, preProcessedSlice) ?? false;
            }

            const html = clipboard.getData("text/html");
            if (html && containsUnorderedList(preProcessedSlice.content)) {
              return dispatchFlattenedPaste(view, preProcessedSlice);
            }

            const text = clipboard.getData("text/plain");
            if (!html && text) {
              const parsedSlice = parsePlainTextSlice(view, text, ctx.get(parserCtx));
              if (containsUnorderedList(parsedSlice.content)) {
                return dispatchFlattenedPaste(view, parsedSlice);
              }
            }

            return previousHandlePaste?.(view, event, preProcessedSlice) ?? false;
          },
        };
      });
    })
    .use(preventNewUnorderedListTransactions);
}
