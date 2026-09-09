/** Milkdown 编辑器公开壳：草稿、字数与宿主生命周期。 */

"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { EDITOR_SYNC_ERROR, type EditorSubmissionHandle } from "@/components/editor/use-editor-submission";
import { assessEditorInput } from "@/lib/editor-content-compatibility";
import { MilkdownProvider } from "@milkdown/react";
import { ContentDraftsPanel } from "@/components/editor/content-drafts-panel";
import { MilkdownEditorHost } from "@/components/editor/milkdown-editor-host";
import { useEditorDraftController } from "@/components/editor/use-editor-draft-controller";
import type { InlineDiceRoll } from "@/lib/dice-inline";
import type { UploadImageOptions } from "@/lib/upload-image";
import { cn } from "@/lib/utils";
import "@/components/editor/milkdown-editor.css";

const MAX_CHARS = 10000;

export interface MilkdownEditorProps {
  defaultValue?: string;
  editorRef?: Ref<EditorSubmissionHandle>;
  onValidityChange?: (valid: boolean) => void;
  onChange?: (value: string) => void;
  onUploadImage?: (file: File, options?: UploadImageOptions) => Promise<string>;
  placeholder?: string;
  disabled?: boolean;
  /** 内容区最大高度（px），超过后内容区出现滚动条；默认 400 */
  maxHeight?: number;
  /** 内容区最小高度（px），保证空白区可点击落位；默认 280 */
  minHeight?: number;
  /** 当前主题帖 ID；提供后启用受权限约束的 @候选菜单。 */
  threadId?: string;
  /** 已由服务端结算的结果；按 nodeId 映射到正文内联节点。 */
  diceRolls?: InlineDiceRoll[];
  /** 编辑器就绪后聚焦正文；仅用于明确的创建后续写流程。 */
  autoFocus?: boolean;
  /** contenteditable 正文输入区的可访问名称。 */
  ariaLabel?: string;
}

function EditorCore({
  defaultValue,
  editorRef,
  onValidityChange,
  onChange,
  onUploadImage,
  placeholder,
  disabled,
  maxHeight = 400,
  minHeight = 280,
  threadId,
  diceRolls = [],
  autoFocus = false,
  ariaLabel,
}: MilkdownEditorProps) {
  const hostRef = useRef<EditorSubmissionHandle | null>(null);
  const [invalid, setInvalid] = useState(false);
  const hasEditor = useCallback(() => hostRef.current !== null, []);
  const flush = useCallback(() => hostRef.current?.flush() ?? null, []);
  const {
    handleValidityChange,
    markdownContractVersion,
    advertisedMarkdownContractVersion,
    user,
    restoredValue,
    version,
    contractVersionReady,
    currentContent,
    draftOpen,
    setDraftOpen,
    autoSaveEnabled,
    autoSaveStatus,
    handleChange,
    handleRestore,
    handleOpenDrafts,
    handleAutoSaveChange,
  } = useEditorDraftController({
    defaultValue: defaultValue ?? "",
    onChange,
    flush,
    hasEditor,
  });

  const flushForWrite = useCallback(() => {
    const content = flush();
    return content !== null && assessEditorInput(content, advertisedMarkdownContractVersion).edit ? content : null;
  }, [advertisedMarkdownContractVersion, flush]);

  const handleValidity = useCallback((valid: boolean) => {
    setInvalid(!valid);
    handleValidityChange(valid);
    onValidityChange?.(valid);
  }, [handleValidityChange, onValidityChange]);
  useEffect(() => {
    if (!invalid) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [invalid]);

  const protectedContent = contractVersionReady && !assessEditorInput(currentContent, markdownContractVersion).edit;
  useImperativeHandle(editorRef, () => ({ flush: flushForWrite, canClose: () => protectedContent || flush() !== null }), [flush, flushForWrite, protectedContent]);
  useEffect(() => {
    if (protectedContent) {
      handleValidityChange(false);
      onValidityChange?.(false);
    }
  }, [handleValidityChange, onValidityChange, protectedContent]);

  const charCount = currentContent.length;
  const editorAriaLabel = ariaLabel ?? placeholder ?? "正文编辑器";
  const charWarning = charCount > MAX_CHARS * 0.9
    ? "text-destructive"
    : charCount > MAX_CHARS * 0.7
      ? "text-warning"
      : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background overflow-hidden",
        disabled && "opacity-60 pointer-events-none",
      )}
      style={{
        "--editor-min-height": `${minHeight}px`,
        "--editor-max-height": `${maxHeight}px`,
      } as React.CSSProperties}
    >
      {contractVersionReady && !protectedContent && (
        <MilkdownEditorHost
          key={`${version}-${user?.id ?? "guest"}`}
          initialValue={restoredValue ?? ""}
          markdownContractVersion={markdownContractVersion}
          editorRef={hostRef}
          onValidityChange={handleValidity}
          onChange={handleChange}
          onUploadImage={onUploadImage}
          placeholder={placeholder}
          disabled={disabled}
          onOpenDrafts={user ? handleOpenDrafts : undefined}
          maxHeight={maxHeight}
          minHeight={minHeight}
          threadId={threadId}
          diceRolls={diceRolls}
          autoFocus={autoFocus}
          ariaLabel={editorAriaLabel}
          footerStatus={(
          <div className="flex items-center gap-3">
            {(autoSaveEnabled || autoSaveStatus === "error") && (
              <span className={cn(
                "text-xs",
                autoSaveStatus === "error" ? "text-destructive" : "text-muted-foreground",
              )}>
                自动草稿：
                {autoSaveStatus === "saving"
                  ? "保存中"
                  : autoSaveStatus === "saved"
                    ? "已保存"
                    : autoSaveStatus === "error"
                      ? "保存失败"
                      : "等待编辑"}
              </span>
            )}
            <span className={cn("text-xs tabular-nums", charWarning)}>
              {charCount}/{MAX_CHARS}
            </span>
          </div>
          )}
        />
      )}
      {protectedContent && (
        <div className="space-y-2 p-3">
          <p role="alert" className="text-sm text-destructive">此正文包含当前版本无法安全编辑的内容，原文已保留。请使用兼容版本继续编辑。</p>
          <pre className="whitespace-pre-wrap break-words text-sm">{currentContent}</pre>
        </div>
      )}
      {invalid && !protectedContent && <p role="alert" className="px-3 py-2 text-sm text-destructive">{EDITOR_SYNC_ERROR}</p>}
      {draftOpen && (
        <ContentDraftsPanel
          open
          onClose={() => setDraftOpen(false)}
          onRestore={handleRestore}
          initialContent={currentContent}
          flush={flushForWrite}
          autoSaveEnabled={autoSaveEnabled}
          autoSaveStatus={autoSaveStatus}
          onAutoSaveChange={handleAutoSaveChange}
        />
      )}
    </div>
  );
}

export function MilkdownEditor(props: MilkdownEditorProps) {
  return (
    <MilkdownProvider>
      <EditorCore {...props} />
    </MilkdownProvider>
  );
}
