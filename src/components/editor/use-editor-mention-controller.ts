"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx } from "@milkdown/core";
import type { EditorView } from "@milkdown/kit/prose/view";
import { getMentionUserId, markEditorMentionAnchors } from "@/lib/mention";
import type { MentionMenuItem } from "@/components/editor/mention-candidate-menu";

export interface EditorMentionMenu {
  from: number;
  to: number;
  query: string;
  top: number;
  left: number;
}

interface UseEditorMentionControllerOptions {
  hostRef: RefObject<HTMLDivElement | null>;
  crepeRef: RefObject<CrepeBuilder | null>;
  disabled?: boolean;
  loading: boolean;
  threadId?: string;
  items: MentionMenuItem[];
  setMenu: Dispatch<SetStateAction<EditorMentionMenu | null>>;
  setSelectedIndex: Dispatch<SetStateAction<number>>;
  /** 直接事务完成后立即向外层同步 Markdown，避免抢在 Milkdown 防抖事件前提交旧正文。 */
  onDocumentChange: (view: EditorView) => void;
}

/** 管理编辑器内 @提及的 DOM 监听、原子删除、键盘导航与插入事务。 */
export function useEditorMentionController({
  hostRef,
  crepeRef,
  disabled,
  loading,
  threadId,
  items,
  setMenu,
  setSelectedIndex,
  onDocumentChange,
}: UseEditorMentionControllerOptions) {
  const editorDomRef = useRef<HTMLElement | null>(null);
  const editorCleanupRef = useRef<(() => void) | null>(null);
  const menuRef = useRef<{ from: number; to: number; query: string } | null>(null);
  const itemsRef = useRef<MentionMenuItem[]>([]);
  const selectedIndexRef = useRef(0);
  const isComposingRef = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
    selectedIndexRef.current = Math.min(
      selectedIndexRef.current,
      Math.max(items.length - 1, 0),
    );
  }, [items]);

  const insertMention = useCallback((item: MentionMenuItem) => {
    const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
    const range = menuRef.current;
    if (!view || !range) return;

    if (item.isGroup) {
      view.dispatch(view.state.tr.insertText("@全体玩家 ", range.from, range.to));
    } else {
      const linkMarkType = view.state.schema.marks.link;
      if (!linkMarkType || !item.username) return;
      const linkMark = linkMarkType.create({
        href: `/users/${item.id}`,
        title: null,
      });
      const mentionNode = view.state.schema.text(`@${item.username}`, [linkMark]);
      const transaction = view.state.tr.replaceWith(range.from, range.to, mentionNode);
      transaction.insertText(" ", range.from + mentionNode.nodeSize);
      view.dispatch(transaction);
    }

    onDocumentChange(view);
    view.focus();
    menuRef.current = null;
    setMenu(null);
  }, [crepeRef, onDocumentChange, setMenu]);

  const handleMentionSelect = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.mentionId;
    const item = itemsRef.current.find((candidate) => candidate.id === itemId);
    if (item) insertMention(item);
  }, [insertMention]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !threadId) return;

    const viewForInsert = () =>
      crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx)) ?? null;

    const isMentionNode = (node: unknown): node is {
      isText: boolean;
      nodeSize: number;
      text: string;
      marks: Array<{ type: { name: string }; attrs: { href?: string } }>;
    } => {
      if (!node || typeof node !== "object") return false;
      const candidate = node as {
        isText?: boolean;
        nodeSize?: number;
        text?: string;
        marks?: Array<{ type: { name: string }; attrs: { href?: string } }>;
      };
      return Boolean(
        candidate.isText &&
          candidate.nodeSize &&
          candidate.text &&
          candidate.marks?.some(
            (mark) =>
              mark.type.name === "link" &&
              getMentionUserId(mark.attrs.href, candidate.text),
          ),
      );
    };

    const findMentionRangeAt = (
      view: ReturnType<typeof viewForInsert>,
      position: number,
      direction: "back" | "delete",
    ): { from: number; to: number } | null => {
      if (!view) return null;
      const resolved = view.state.doc.resolve(position);
      const parentStart = resolved.start();
      let result: { from: number; to: number } | null = null;
      resolved.parent.forEach((node, offset) => {
        if (!isMentionNode(node)) return;
        const from = parentStart + offset;
        const to = from + node.nodeSize;
        const matches = direction === "back"
          ? position > from && position <= to
          : position >= from && position < to;
        if (matches) result = { from, to };
      });
      return result;
    };

    const updateMentionMenu = () => {
      const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
      const editor = editorDomRef.current;
      if (!view || !editor || disabled || isComposingRef.current) return;
      const { from, empty } = view.state.selection;
      if (!empty) {
        menuRef.current = null;
        setMenu(null);
        return;
      }
      const resolved = view.state.doc.resolve(from);
      const textBefore = resolved.parent.textBetween(0, resolved.parentOffset, "\n", "\n");
      const match = /(^|[\s([>])@([a-zA-Z0-9_\u4e00-\u9fff]{0,24})$/u.exec(textBefore);
      if (!match) {
        menuRef.current = null;
        setMenu(null);
        return;
      }
      const range = {
        from: from - match[0].length + match[1].length,
        to: from,
        query: match[2] ?? "",
      };
      const coords = view.coordsAtPos(from);
      const menuWidth = Math.min(288, Math.max(224, window.innerWidth - 16));
      const menuHeight = 240;
      const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
      const belowTop = coords.bottom + 4;
      const aboveTop = coords.top - menuHeight - 4;
      const top = coords.bottom + menuHeight > window.innerHeight && aboveTop > 8
        ? aboveTop
        : belowTop;
      menuRef.current = range;
      setMenu({
        ...range,
        top,
        left: Math.min(maxLeft, Math.max(8, coords.left)),
      });
    };

    const attach = () => {
      const editor = host.querySelector<HTMLElement>(".ProseMirror");
      if (!editor) return;
      markEditorMentionAnchors(editor);
      if (editorDomRef.current === editor) return;
      editorDomRef.current = editor;
      const handleCompositionStart = () => {
        isComposingRef.current = true;
      };
      const handleCompositionEnd = () => {
        isComposingRef.current = false;
        window.requestAnimationFrame(() => {
          markEditorMentionAnchors(editor);
          updateMentionMenu();
        });
      };
      const handleInput = () => {
        markEditorMentionAnchors(editor);
        updateMentionMenu();
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (isComposingRef.current || event.isComposing) return;
        const view = viewForInsert();
        if (!view) return;

        if (event.key === "Backspace" || event.key === "Delete") {
          const direction: "back" | "delete" = event.key === "Backspace" ? "back" : "delete";
          let range = findMentionRangeAt(view, view.state.selection.from, direction);
          if (
            event.key === "Backspace" &&
            !range &&
            view.state.selection.empty &&
            view.state.selection.from > 0 &&
            view.state.doc.resolve(view.state.selection.from).nodeBefore?.text?.endsWith(" ")
          ) {
            range = findMentionRangeAt(view, view.state.selection.from - 1, "back");
            if (range) range.to = view.state.selection.from;
          }
          if (range) {
            event.preventDefault();
            view.dispatch(view.state.tr.delete(range.from, range.to).scrollIntoView());
            onDocumentChange(view);
            window.requestAnimationFrame(updateMentionMenu);
            return;
          }
        }

        const menu = menuRef.current;
        const candidates = itemsRef.current;
        if (!menu || candidates.length === 0) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          const next = (selectedIndexRef.current + 1) % candidates.length;
          selectedIndexRef.current = next;
          setSelectedIndex(next);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          const next = (selectedIndexRef.current - 1 + candidates.length) % candidates.length;
          selectedIndexRef.current = next;
          setSelectedIndex(next);
        } else if (event.key === "Escape") {
          event.preventDefault();
          menuRef.current = null;
          setMenu(null);
        } else if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const item = candidates[selectedIndexRef.current] ?? candidates[0];
          insertMention(item);
        }
      };
      editor.addEventListener("compositionstart", handleCompositionStart);
      editor.addEventListener("compositionend", handleCompositionEnd);
      editor.addEventListener("input", handleInput);
      editor.addEventListener("keyup", updateMentionMenu);
      editor.addEventListener("keydown", handleKeyDown);
      editorCleanupRef.current = () => {
        editor.removeEventListener("compositionstart", handleCompositionStart);
        editor.removeEventListener("compositionend", handleCompositionEnd);
        editor.removeEventListener("input", handleInput);
        editor.removeEventListener("keyup", updateMentionMenu);
        editor.removeEventListener("keydown", handleKeyDown);
        editorDomRef.current = null;
      };
      updateMentionMenu();
    };

    const observer = new MutationObserver(attach);
    observer.observe(host, { childList: true, subtree: true });
    window.addEventListener("resize", updateMentionMenu);
    window.addEventListener("scroll", updateMentionMenu, true);
    attach();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMentionMenu);
      window.removeEventListener("scroll", updateMentionMenu, true);
      editorCleanupRef.current?.();
      editorCleanupRef.current = null;
      menuRef.current = null;
      setMenu(null);
    };
  }, [crepeRef, disabled, hostRef, insertMention, loading, onDocumentChange, setMenu, setSelectedIndex, threadId]);

  return { handleMentionSelect };
}
