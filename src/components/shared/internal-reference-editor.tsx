"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { baseKeymap } from "@milkdown/kit/prose/commands";
import { history, redo, undo } from "@milkdown/kit/prose/history";
import { keymap } from "@milkdown/kit/prose/keymap";
import { Schema, type Mark, type Node as ProseNode } from "@milkdown/kit/prose/model";
import { EditorState } from "@milkdown/kit/prose/state";
import { EditorView } from "@milkdown/kit/prose/view";
import {
  createEditorLinkMarkView,
  handleInternalReferenceUrlPaste,
  insertInternalReferenceAtSelection,
} from "@/components/shared/internal-reference-editor-dom";
import {
  parseInternalReference,
  serializeInternalReference,
  tokenizeInternalReferenceText,
} from "@/lib/internal-reference";
import { cn } from "@/lib/utils";

const editorSchema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM: () => ["br"],
    },
    text: { group: "inline" },
  },
  marks: {
    link: {
      inclusive: false,
      attrs: {
        href: {},
        title: { default: null },
        source: { default: null },
        originalLabel: { default: null },
      },
      parseDOM: [{
        tag: "a[href]",
        getAttrs: (dom) => ({
          href: (dom as HTMLElement).getAttribute("href") ?? "",
          title: (dom as HTMLElement).getAttribute("title"),
          source: null,
          originalLabel: null,
        }),
      }],
      toDOM: (mark) => ["a", { href: mark.attrs.href, title: mark.attrs.title }, 0],
    },
  },
});

function createEditorDocument(value: string): ProseNode {
  const paragraphs: ProseNode[][] = [[]];
  const appendText = (text: string, marks: Mark[] = []) => {
    const lines = text.replace(/\r\n?/gu, "\n").split("\n");
    lines.forEach((line, index) => {
      if (line) paragraphs.at(-1)!.push(editorSchema.text(line, marks));
      if (index < lines.length - 1) paragraphs.push([]);
    });
  };

  for (const segment of tokenizeInternalReferenceText(value)) {
    if (segment.type === "text") {
      appendText(segment.value);
      continue;
    }
    const link = editorSchema.marks.link.create({
      href: segment.reference.href,
      title: null,
      source: segment.source,
      originalLabel: segment.label,
    });
    appendText(segment.label, [link]);
  }

  return editorSchema.node(
    "doc",
    null,
    paragraphs.map((content) => editorSchema.node("paragraph", null, content)),
  );
}

function serializeLinkText(text: string, mark: Mark): string {
  const source = typeof mark.attrs.source === "string" ? mark.attrs.source : null;
  const originalLabel = typeof mark.attrs.originalLabel === "string"
    ? mark.attrs.originalLabel
    : null;
  if (source && originalLabel === text) return source;
  return serializeInternalReference(text, String(mark.attrs.href ?? "")) ?? text;
}

export function serializeInternalReferenceEditorDocument(doc: ProseNode): string {
  const paragraphs: string[] = [];
  doc.forEach((paragraph) => {
    let value = "";
    paragraph.forEach((node) => {
      if (node.type.name === "hard_break") {
        value += "\n";
        return;
      }
      const text = node.text ?? "";
      const link = node.marks.find((mark) => mark.type === editorSchema.marks.link);
      value += link ? serializeLinkText(text, link) : text;
    });
    paragraphs.push(value);
  });
  return paragraphs.join("\n");
}

export interface InternalReferenceEditorHandle {
  focus: (options?: FocusOptions) => void;
  getSelectedText: () => string;
  insertReference: (markdown: string) => boolean;
}

interface InternalReferenceEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onLimitExceeded?: () => void;
  maxLength: number;
  id?: string;
  ariaLabel: string;
  ariaInvalid?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** 动态与评论专用编辑器：保持纯文本协议，只把站内坐标显示成可编辑传送门。 */
export const InternalReferenceEditor = forwardRef<
  InternalReferenceEditorHandle,
  InternalReferenceEditorProps
>(function InternalReferenceEditor({
  value,
  onChange,
  onBlur,
  onLimitExceeded,
  maxLength,
  id,
  ariaLabel,
  ariaInvalid,
  placeholder,
  disabled = false,
  className,
}, forwardedRef) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const onLimitExceededRef = useRef(onLimitExceeded);
  const maxLengthRef = useRef(maxLength);
  const disabledRef = useRef(disabled);
  const initialAttributesRef = useRef({ id, ariaLabel, ariaInvalid, placeholder });

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onBlurRef.current = onBlur; }, [onBlur]);
  useEffect(() => { onLimitExceededRef.current = onLimitExceeded; }, [onLimitExceeded]);
  useEffect(() => { maxLengthRef.current = maxLength; }, [maxLength]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const fitsLimit = (doc: ProseNode) =>
      serializeInternalReferenceEditorDocument(doc).length <= maxLengthRef.current;
    const notifyLimit = () => onLimitExceededRef.current?.();
    const initialAttributes = initialAttributesRef.current;
    const view = new EditorView(mount, {
      state: EditorState.create({
        schema: editorSchema,
        doc: createEditorDocument(valueRef.current),
        plugins: [
          history(),
          keymap({ "Mod-z": undo, "Mod-y": redo, "Mod-Shift-z": redo }),
          keymap(baseKeymap),
        ],
      }),
      editable: () => !disabledRef.current,
      attributes: {
        ...(initialAttributes.id ? { id: initialAttributes.id } : {}),
        class: "internal-reference-editor",
        role: "textbox",
        "aria-label": initialAttributes.ariaLabel,
        "aria-multiline": "true",
        "aria-invalid": initialAttributes.ariaInvalid ? "true" : "false",
        "data-placeholder": initialAttributes.placeholder ?? "",
        placeholder: initialAttributes.placeholder ?? "",
      },
      markViews: {
        link: (mark) => createEditorLinkMarkView(mark),
      },
      handleDOMEvents: {
        blur: () => {
          onBlurRef.current?.();
          return false;
        },
      },
      handlePaste: (editorView, event) => {
        const plain = event.clipboardData?.getData("text/plain") ?? "";
        const reference = parseInternalReference(plain.trim());
        if (reference) {
          const applied = handleInternalReferenceUrlPaste(editorView, event, {
            canApply: (transaction) => fitsLimit(transaction.doc),
          });
          if (!applied) {
            event.preventDefault();
            notifyLimit();
          }
          return true;
        }
        if (!plain) return false;
        const link = editorView.state.schema.marks.link;
        const transaction = editorView.state.tr
          .insertText(plain)
          .removeStoredMark(link)
          .scrollIntoView();
        if (!fitsLimit(transaction.doc)) {
          event.preventDefault();
          notifyLimit();
          return true;
        }
        editorView.dispatch(transaction);
        event.preventDefault();
        return true;
      },
      dispatchTransaction: (transaction) => {
        const nextState = view.state.apply(transaction);
        const serialized = serializeInternalReferenceEditorDocument(nextState.doc);
        if (transaction.docChanged && serialized.length > maxLengthRef.current) {
          notifyLimit();
          return;
        }
        view.updateState(nextState);
        view.dom.dataset.empty = serialized ? "false" : "true";
        if (transaction.docChanged) {
          valueRef.current = serialized;
          onChangeRef.current(serialized);
        }
      },
    });
    view.dom.dataset.empty = valueRef.current ? "false" : "true";
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === valueRef.current) return;
    valueRef.current = value;
    view.updateState(EditorState.create({
      schema: editorSchema,
      doc: createEditorDocument(value),
      plugins: view.state.plugins,
    }));
    view.dom.dataset.empty = value ? "false" : "true";
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    disabledRef.current = disabled;
    view.setProps({ editable: () => !disabledRef.current });
    if (id) view.dom.id = id;
    else view.dom.removeAttribute("id");
    view.dom.setAttribute("aria-label", ariaLabel);
    view.dom.setAttribute("aria-disabled", disabled ? "true" : "false");
    view.dom.setAttribute("aria-invalid", ariaInvalid ? "true" : "false");
    view.dom.dataset.placeholder = placeholder ?? "";
    view.dom.setAttribute("placeholder", placeholder ?? "");
  }, [ariaInvalid, ariaLabel, disabled, id, placeholder]);

  useImperativeHandle(forwardedRef, () => ({
    focus: (options) => viewRef.current?.dom.focus(options),
    getSelectedText: () => {
      const view = viewRef.current;
      if (!view) return "";
      const { from, to } = view.state.selection;
      return view.state.doc.textBetween(from, to, " ");
    },
    insertReference: (markdown) => {
      const view = viewRef.current;
      if (!view) return false;
      const segments = tokenizeInternalReferenceText(markdown);
      const portal = segments.length === 1 && segments[0]?.type === "portal"
        ? segments[0]
        : null;
      if (!portal) return false;
      const applied = insertInternalReferenceAtSelection(view, portal.reference.href, {
        label: portal.label,
        canApply: (transaction) =>
          serializeInternalReferenceEditorDocument(transaction.doc).length <= maxLengthRef.current,
      });
      if (!applied) {
        onLimitExceededRef.current?.();
        return false;
      }
      view.focus();
      return true;
    },
  }), []);

  return (
    <div
      ref={mountRef}
      className={cn(
        "internal-reference-editor-shell relative rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow]",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        ariaInvalid && "border-destructive ring-destructive/20",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    />
  );
});
