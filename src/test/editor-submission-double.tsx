import { useImperativeHandle, useRef, type ComponentType } from "react";
import type { MilkdownEditorProps } from "@/components/editor/milkdown-editor-core";

/** 旧表单单测替身补齐同步接口；真实 codec 失败回归仍运行 Crepe。 */
export function withEditorSubmission(Component: ComponentType<MilkdownEditorProps>, options?: { deferChange?: () => boolean }) {
  return function EditorDouble(props: MilkdownEditorProps) {
    const { onChange } = props;
    const value = useRef(props.defaultValue ?? "");
    const pending = useRef(false);
    useImperativeHandle(props.editorRef, () => ({ flush: () => {
      if (pending.current) { pending.current = false; onChange?.(value.current); }
      return value.current;
    } }), [onChange]);
    return <Component {...props} onChange={(next) => {
      value.current = next;
      props.onDocumentChange?.();
      pending.current = options?.deferChange?.() ?? false;
      if (!pending.current) props.onChange?.(next);
    }} />;
  };
}
