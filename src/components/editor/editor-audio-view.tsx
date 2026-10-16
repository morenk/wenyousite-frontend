"use client";

import { createElement, Fragment, useCallback, useEffect, useMemo, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DOMSerializer, type Node as ProseNode } from "@milkdown/kit/prose/model";
import { NodeSelection, Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { AudioPlayer } from "@/components/shared/audio-player";
import { findMediaAudio, isValidMediaAudio, type MarkdownMediaAudio } from "@/lib/markdown-audio";
import { loadAudioProjections, saveAudioProjection } from "@/lib/audio-draft";

const labelTags: Record<string, string> = { strong: "strong", emphasis: "em", strike_through: "del", inlineCode: "code" };
/** 只识别已有 link 模型；独立同 URL 链接的内部边界仍需分别保留。 */
export function paragraphAudio(node: ProseNode, mappings: readonly MarkdownMediaAudio[]): MarkdownMediaAudio | undefined {
  if (node.type.name !== "paragraph" || !node.childCount) return;
  const first = node.firstChild?.marks.find((mark) => mark.type.name === "link");
  if (!first || first.attrs.title != null) return;
  let supported = true;
  node.forEach((child) => {
    if (!child.isText || !child.marks.some((mark) => mark.eq(first))
      || child.marks.some((mark) => mark.type.name !== "link" && !labelTags[mark.type.name])) supported = false;
  });
  return supported ? findMediaAudio(String(first.attrs.href), mappings) : undefined;
}
function audioLabel(node: ProseNode): ReactNode {
  const children: ReactNode[] = [];
  node.forEach((child, _offset, index) => {
    let label: ReactNode = child.text ?? "";
    for (const mark of [...child.marks].reverse()) if (labelTags[mark.type.name]) label = createElement(labelTags[mark.type.name], null, label);
    children.push(<Fragment key={index}>{label}</Fragment>);
  });
  return children;
}
type AudioMount = { id: number; dom: HTMLElement; node: ProseNode; media: MarkdownMediaAudio };

/** 普通段落无 React root；只有可信音频段落通过宿主 portal 复用正文播放器。 */
export function createEditorAudioProjection(initial?: readonly MarkdownMediaAudio[]) {
  let mappings = (initial ?? []).filter(isValidMediaAudio);
  const uploaded = new Map<string, MarkdownMediaAudio>();
  let snapshot: readonly MarkdownMediaAudio[] = mappings;
  const mounts = new Map<number, AudioMount>(); let mounted: readonly AudioMount[] = []; let nextId = 0;
  const subscribers = new Set<() => void>();
  let attached: EditorView | null = null;
  const key = new PluginKey("wenyou-audio-view");
  const emit = () => { mounted = [...mounts.values()]; subscribers.forEach((notify) => notify()); };
  const resolve = (node: ProseNode, position: number, view: EditorView) => view.state.doc.resolve(position).depth === 0 ? paragraphAudio(node, snapshot) : undefined;
  const refresh = () => { if (attached && !attached.isDestroyed) attached.dispatch(attached.state.tr.setMeta(key, true).setMeta("addToHistory", false)); };
  const merge = () => {
    const next = [...new Map([...mappings, ...uploaded.values()].map((media) => [media.sourceUrl, media])).values()];
    if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
    snapshot = next; refresh();
  };
  const controls = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("button,input"));
  const selectCard = (view: EditorView, _pos: number, node: ProseNode, nodePos: number, event: MouseEvent, direct: boolean) => {
        if (!direct || !view.editable || controls(event.target) || !resolve(node, nodePos, view)) return false;
        view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos))); view.focus(); return true;
  };

  const plugin = $prose(() => new Plugin({
    key,
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        state.doc.forEach((node, pos) => {
          const media = paragraphAudio(node, snapshot);
          if (media) decorations.push(Decoration.node(pos, pos + node.nodeSize, { "data-editor-audio-projection": JSON.stringify(media) }));
        });
        return DecorationSet.create(state.doc, decorations);
      },
      nodeViews: {
        paragraph(node, view, getPos) {
          const position = getPos();
          const media = typeof position === "number" ? resolve(node, position, view) : undefined;
          if (!media) {
            const rendered = DOMSerializer.renderSpec(document, node.type.spec.toDOM?.(node) ?? ["p", 0]);
            return { dom: rendered.dom, contentDOM: rendered.contentDOM,
              update(next) {
                const pos = getPos();
                return next.type === node.type && JSON.stringify(next.attrs) === JSON.stringify(node.attrs)
                  && !(typeof pos === "number" && resolve(next, pos, view));
              } };
          }
          const id = nextId++; const dom = document.createElement("div");
          dom.contentEditable = "false"; dom.draggable = view.editable; dom.dataset.editorAudio = "true";
          dom.className = "editor-audio-node";
          mounts.set(id, { id, dom, node, media }); emit();
          // 播放控件的 pointer 手势不能启动父卡片的 HTML 原生拖放。
          dom.addEventListener("pointerdown", (event) => { dom.draggable = view.editable && !controls(event.target); }, true);
          dom.addEventListener("pointerup", () => { dom.draggable = view.editable; }, true);
          dom.addEventListener("pointercancel", () => { dom.draggable = view.editable; }, true);
          dom.addEventListener("dragstart", (event) => { if (controls(event.target) || !view.editable) event.preventDefault(); });
          return { dom,
            update(next) {
              const pos = getPos(); const nextMedia = typeof pos === "number" ? resolve(next, pos, view) : undefined;
              if (!nextMedia) return false;
              const old = mounts.get(id)!;
              if (!old.node.eq(next) || JSON.stringify(old.media) !== JSON.stringify(nextMedia)) { mounts.set(id, { id, dom, node: next, media: nextMedia }); emit(); }
              dom.draggable = view.editable; return true;
            },
            selectNode() { dom.classList.add("ProseMirror-selectednode"); },
            deselectNode() { dom.classList.remove("ProseMirror-selectednode"); },
            stopEvent: (event) => controls(event.target), ignoreMutation: () => true,
            destroy() { mounts.delete(id); emit(); },
          };
        },
      },
      handleClickOn: selectCard,
      handleDoubleClickOn: selectCard,
      handleTripleClickOn: selectCard,
      handleKeyDown(view, event) {
        if (!view.editable || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false;
        const { selection, doc } = view.state;
        if (selection instanceof NodeSelection && resolve(selection.node, selection.from, view)) {
          if (["Backspace", "Delete"].includes(event.key)) { view.dispatch(view.state.tr.deleteSelection().scrollIntoView()); return true; }
          const before = ["ArrowLeft", "ArrowUp"].includes(event.key);
          if (before || ["ArrowRight", "ArrowDown", "Enter"].includes(event.key)) {
            const boundary = before ? selection.from : selection.to;
            const adjacent = before ? doc.resolve(boundary).nodeBefore : doc.resolve(boundary).nodeAfter;
            const transaction = view.state.tr;
            if (!adjacent || !adjacent.isTextblock || paragraphAudio(adjacent, snapshot)) {
              transaction.insert(boundary, view.state.schema.nodes.paragraph.create());
              transaction.setSelection(TextSelection.create(transaction.doc, boundary + 1));
            } else transaction.setSelection(TextSelection.near(transaction.doc.resolve(boundary), before ? -1 : 1));
            view.dispatch(transaction.scrollIntoView()); view.focus(); return true;
          }
        }
        if (selection.empty && selection.$from.depth === 1) {
          const current = selection.$from;
          const previous = event.key === "Backspace" && current.parentOffset === 0;
          const next = event.key === "Delete" && current.parentOffset === current.parent.content.size;
          if (previous || next) {
            const boundary = previous ? current.before() : current.after();
            const sibling = previous ? doc.resolve(boundary).nodeBefore : doc.resolve(boundary).nodeAfter;
            if (sibling && paragraphAudio(sibling, snapshot)) {
              view.dispatch(view.state.tr.setSelection(NodeSelection.create(doc, previous ? boundary - sibling.nodeSize : boundary))); return true;
            }
          }
        }
        return false;
      },
    },
    appendTransaction(transactions, _previous, state) {
      if (!transactions.some((transaction) => transaction.selectionSet || transaction.docChanged || transaction.getMeta(key))) return;
      const selection = state.selection;
      if (selection.empty && selection.$from.depth === 1 && paragraphAudio(selection.$from.parent, snapshot)) {
        return state.tr.setSelection(NodeSelection.create(state.doc, selection.$from.before())).setMeta("addToHistory", false);
      }
    },
    view(view) { attached = view; return { update(next) { attached = next; mounts.forEach(({ dom }) => { dom.draggable = next.editable; }); }, destroy() { if (attached === view) attached = null; } }; },
  }));
  return { plugin, snapshot: () => snapshot,
    update(next?: readonly MarkdownMediaAudio[]) { mappings = (next ?? []).filter(isValidMediaAudio); merge(); },
    reset(next?: readonly MarkdownMediaAudio[]) { uploaded.clear(); mappings = (next ?? []).filter(isValidMediaAudio); merge(); },
    completed(media: MarkdownMediaAudio) { if (isValidMediaAudio(media)) { uploaded.set(media.sourceUrl, media); merge(); } },
    subscribe(callback: () => void) { subscribers.add(callback); return () => subscribers.delete(callback); },
    getMounts: () => mounted,
  };
}

class ProjectionSession {
  active = true;
  constructor(readonly key: string | null, readonly userId?: string, readonly draftKey?: string) {}
  activate() { this.active = true; }
  invalidate() { this.active = false; }
}

export function useEditorAudioView(mappings: readonly MarkdownMediaAudio[] | undefined, userId?: string, draftKey?: string) {
  const [api] = useState(() => createEditorAudioProjection(mappings));
  const scopeKey = userId && draftKey ? JSON.stringify([userId, draftKey]) : null;
  const session = useMemo(() => new ProjectionSession(scopeKey, userId, draftKey), [scopeKey, userId, draftKey]);
  useLayoutEffect(() => { session.activate(); api.reset(); return () => { session.invalidate(); }; }, [api, session]);
  useEffect(() => {
    api.update(mappings);
  }, [api, mappings, session]);
  useEffect(() => {
    let active = true;
    if (scopeKey && userId) void loadAudioProjections(scopeKey, userId).then((media) => { if (active) media.forEach(api.completed); }).catch(() => {});
    return () => { active = false; };
  }, [api, scopeKey, userId]);
  const mounts = useSyncExternalStore(api.subscribe, api.getMounts, api.getMounts);
  const completed = useCallback(async (media: MarkdownMediaAudio) => {
    if (!session.active) throw new DOMException("编辑目标已改变", "AbortError");
    api.completed(media);
    if (session.key && userId) await saveAudioProjection(session.key, userId, media);
    if (!session.active) throw new DOMException("编辑目标已改变", "AbortError");
  }, [api, session, userId]);
  return { api, completed, portals: mounts.map(({ id, dom, node, media }) => createPortal(<AudioPlayer media={media} showDownload={false}>{audioLabel(node)}</AudioPlayer>, dom, String(id))) };
}
