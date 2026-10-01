"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export interface EditorSubmissionHandle {
  /** 直接编码当前文档；加载中、保护状态或编码失败返回 null，空正文返回空字符串。 */
  flush: () => string | null;
  canClose?: () => boolean;
  isComposing?: () => boolean;
}

export const EDITOR_COMPOSITION_MESSAGE = "请先完成输入法选词，再保存或离开编辑器";

export const EDITOR_SYNC_ERROR = "正文尚未同步，当前输入已保留，请撤销或重试后再保存";

/** 所有正文持久化入口共享同步出口；父表单中的旧值不能作为失败回退。 */
export function useEditorSubmission() {
  const editorRef = useRef<EditorSubmissionHandle | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const documentVersion = useRef(0);
  const onDocumentChange = useCallback(() => {
    documentVersion.current++;
    setHasPendingChanges(true);
  }, []);
  const onSynchronized = useCallback(() => setHasPendingChanges(false), []);
  const getDocumentVersion = useCallback(() => documentVersion.current, []);
  const ready = useCallback(() => {
    if (!editorRef.current?.isComposing?.()) return true;
    toast.error(EDITOR_COMPOSITION_MESSAGE);
    return false;
  }, []);
  const onValidityChange = useCallback((valid: boolean) => setInvalid(!valid), []);
  const flush = useCallback(() => {
    if (!ready()) return null;
    const content = editorRef.current?.flush() ?? null;
    if (content === null) toast.error(EDITOR_SYNC_ERROR);
    if (content !== null && Array.from(content).length > 10000) {
      toast.error("正文最多 10000 个字符");
      return null;
    }
    return content;
  }, [ready]);
  const canClose = useCallback(() => ready() && (editorRef.current?.canClose?.() ?? (flush() !== null)), [flush, ready]);
  const isCurrent = useCallback((content: string) => {
    const current = flush();
    if (current === null) return false;
    if (current === content) return true;
    toast.error("正文已变化，请再次提交");
    return false;
  }, [flush]);
  return { editorRef, invalid, onValidityChange, flush, isCurrent, canClose, ready, onDocumentChange, onSynchronized, hasPendingChanges, getDocumentVersion };
}
