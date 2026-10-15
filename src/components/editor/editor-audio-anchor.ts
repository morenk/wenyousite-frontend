import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

/** 上传占位仅存在于 decoration，不进入正文、撤销历史或云草稿。 */
export function createAudioUploadAnchor() {
  const key = new PluginKey<number | null>("wenyou-audio-upload");
  let target: HTMLElement | null = null;
  return {
    setTarget(element: HTMLElement | null) { target = element; },
    plugin: $prose(() => new Plugin<number | null>({
      key,
      state: {
        init: () => null,
        apply(transaction, previous) {
          const meta = transaction.getMeta(key) as { position: number | null } | undefined;
          if (meta) return meta.position;
          return previous === null ? null : transaction.mapping.map(previous, 1);
        },
      },
      props: {
        decorations(state) {
          const position = key.getState(state);
          return position == null || !target ? DecorationSet.empty : DecorationSet.create(state.doc, [
            Decoration.widget(position, target, { key: "audio-upload", side: 1, stopEvent: () => true, ignoreSelection: true }),
          ]);
        },
      },
    })),
    start(view: EditorView) {
      const selection = view.state.selection.$to;
      const position = selection.depth ? selection.after(1) : selection.pos;
      view.dispatch(view.state.tr.setMeta(key, { position }).setMeta("addToHistory", false));
    },
    remove(view: EditorView) { view.dispatch(view.state.tr.setMeta(key, { position: null }).setMeta("addToHistory", false)); },
    insert(view: EditorView, sourceUrl: string) {
      const saved = key.getState(view.state);
      if (saved == null) return false;
      const resolved = view.state.doc.resolve(Math.min(saved, view.state.doc.content.size));
      const position = resolved.depth ? resolved.after(1) : resolved.pos;
      const schema = view.state.schema;
      const paragraph = schema.nodes.paragraph.create(null, schema.text("音频", [schema.marks.link.create({ href: sourceUrl, title: null, sourceLinkStandalone: true })]));
      const transaction = view.state.tr.insert(position, paragraph).setMeta(key, { position: null });
      transaction.setSelection(TextSelection.near(transaction.doc.resolve(position + paragraph.nodeSize)));
      view.dispatch(transaction.scrollIntoView());
      return true;
    },
  };
}
