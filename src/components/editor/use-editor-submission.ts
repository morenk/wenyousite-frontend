"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export interface EditorSubmissionHandle {
  /** 直接编码当前文档；加载中、保护状态或编码失败返回 null，空正文返回空字符串。 */
  flush: () => string | null;
  canClose?: () => boolean;
}

export const EDITOR_SYNC_ERROR = "正文尚未同步，当前输入已保留，请撤销或重试后再保存";

/** 所有正文持久化入口共享同步出口；父表单中的旧值不能作为失败回退。 */
export function useEditorSubmission() {
  const editorRef = useRef<EditorSubmissionHandle | null>(null);
  const [invalid, setInvalid] = useState(false);
  const onValidityChange = useCallback((valid: boolean) => setInvalid(!valid), []);
  const flush = useCallback(() => {
    const content = editorRef.current?.flush() ?? null;
    if (content === null) toast.error(EDITOR_SYNC_ERROR);
    return content;
  }, []);
  const canClose = useCallback(() => editorRef.current?.canClose?.() ?? (flush() !== null), [flush]);
  const isCurrent = useCallback((content: string) => {
    const current = flush();
    if (current === null) return false;
    if (current === content) return true;
    toast.error("正文已变化，请再次提交");
    return false;
  }, [flush]);
  return { editorRef, invalid, onValidityChange, flush, isCurrent, canClose };
}
