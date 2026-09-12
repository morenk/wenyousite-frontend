import { useImperativeHandle, useRef, type ComponentType } from "react";
import type { MilkdownEditorProps } from "@/components/editor/milkdown-editor-core";

/** 旧表单单测替身补齐同步接口；真实 codec 失败回归仍运行 Crepe。 */
export function withEditorSubmission(Component: ComponentType<MilkdownEditorProps>) {
  return function EditorDouble(props: MilkdownEditorProps) {
    const value = useRef(props.defaultValue ?? "");
    useImperativeHandle(props.editorRef, () => ({ flush: () => value.current }), []);
    return <Component {...props} onChange={(next) => {
      value.current = next;
      props.onChange?.(next);
    }} />;
  };
}
