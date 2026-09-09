import type { Ctx } from "@milkdown/kit/ctx";
import { trailingConfig } from "@milkdown/kit/plugin/trailing";

/** 引用末尾已有可编辑文字块，选择或重开不能凭空追加正文空行。 */
export function configureEditorStableTrailing(ctx: Ctx) {
  ctx.update(trailingConfig.key, (config) => ({
    ...config,
    shouldAppend: (lastNode, state) => {
      const emptyQuote = lastNode?.type.name === "blockquote" && lastNode.childCount === 1
        && lastNode.firstChild?.type.name === "paragraph" && lastNode.firstChild.content.size === 0;
      return (lastNode?.type.name !== "blockquote" || emptyQuote) && config.shouldAppend(lastNode, state);
    },
  }));
}
