import { commandsCtx } from "@milkdown/core";
import { inlineCodeSchema, toggleInlineCodeCommand } from "@milkdown/kit/preset/commonmark";
import { toggleMark } from "@milkdown/kit/prose/commands";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";

/** 工具栏、更多菜单与 Mod-e 共用叠加命令，添加/取消代码不删除其他 marks。 */
export const editorInlineCodeCommand = $prose((ctx) => new Plugin({
  key: new PluginKey("wenyousite-inline-code-command"),
  view: () => {
    // View 创建时默认命令已注册；覆盖同一 command key，保留所有既有入口。
    ctx.get(commandsCtx).create(toggleInlineCodeCommand.key, () =>
      toggleMark(inlineCodeSchema.type(ctx)));
    return {};
  },
}));
