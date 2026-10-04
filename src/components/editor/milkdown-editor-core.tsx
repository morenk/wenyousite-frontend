/** Milkdown 编辑器公开壳：草稿、字数与宿主生命周期。 */

"use client";

import type { MentionIdentity } from "@/lib/thread-identity";

import type { MarkdownMediaDisplay } from "@/lib/media-display";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { EDITOR_COMPOSITION_MESSAGE, EDITOR_SYNC_ERROR, type EditorSubmissionHandle } from "@/components/editor/use-editor-submission";
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
const EMPTY_DICE_ROLLS: InlineDiceRoll[] = [];

export interface MilkdownEditorProps {
  defaultValue?: string;
  mediaDisplays?: readonly MarkdownMediaDisplay[];
  mentionIdentities?: readonly MentionIdentity[];
  editorRef?: Ref<EditorSubmissionHandle>;
  onValidityChange?: (valid: boolean) => void;
  onChange?: (value: string) => void;
  /** 每次文档变更即时通知；onChange 为延后的已验证 Markdown 快照。 */
  onDocumentChange?: () => void;
  onSyncErrorChange?: (hasError: boolean) => void;
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
  mediaDisplays,
  mentionIdentities,
  editorRef,
  onValidityChange,
  onChange,
  onDocumentChange,
  onSyncErrorChange,
  onUploadImage,
  placeholder,
  disabled,
  maxHeight = 400,
  minHeight = 280,
  threadId,
  diceRolls = EMPTY_DICE_ROLLS,
  autoFocus = false,
  ariaLabel,
}: MilkdownEditorProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [footerTarget, setFooterTarget] = useState<Element | null>(null);
  const hostRef = useRef<EditorSubmissionHandle | null>(null);
  const uploadRef = useRef(onUploadImage);
  useEffect(() => { uploadRef.current = onUploadImage; }, [onUploadImage]);
  const upload = useCallback((file: File, options?: UploadImageOptions) => uploadRef.current!(file, options), []);
  const [invalid, setInvalid] = useState(false);
  const hasEditor = useCallback(() => hostRef.current !== null, []);
  const isComposing = useCallback(() => hostRef.current?.isComposing?.() ?? false, []);
  const flush = useCallback(() => hostRef.current?.flush() ?? null, []);
  const {
    syncError,
    handleSyncError,
    handleValidityChange,
    markdownContractVersion,
    advertisedMarkdownContractVersion,
    user,
    restoredValue,
    restoredMediaDisplays,
    version,
    contractVersionReady,
    currentContent,
    draftOpen,
    setDraftOpen,
    autoSaveEnabled,
    autoSaveStatus,
    handleChange,
    handleDocumentChange,
    handleCompositionChange,
    handleRestore,
    handleOpenDrafts,
    handleAutoSaveChange,
  } = useEditorDraftController({
    defaultValue: defaultValue ?? "",
    onChange,
    flush,
    hasEditor,
    isComposing,
    onDocumentChange,
    onSyncErrorChange,
  });

  const writeAssessmentRef = useRef<{ content: string; version: number; allowed: boolean } | null>(null);
  const flushForWrite = useCallback(() => {
    if (isComposing()) { toast.error(EDITOR_COMPOSITION_MESSAGE); return null; }
    const content = flush();
    if (content === null) return null;
    const cached = writeAssessmentRef.current;
    if (!cached || cached.content !== content || cached.version !== advertisedMarkdownContractVersion) {
      writeAssessmentRef.current = { content, version: advertisedMarkdownContractVersion, allowed: assessEditorInput(content, advertisedMarkdownContractVersion).edit };
    }
    return writeAssessmentRef.current!.allowed ? content : null;
  }, [advertisedMarkdownContractVersion, flush, isComposing]);

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

  const protectedContent = useMemo(() => contractVersionReady && !assessEditorInput(restoredValue, markdownContractVersion).edit, [contractVersionReady, restoredValue, markdownContractVersion]);
  useImperativeHandle(editorRef, () => ({ flush: flushForWrite, isComposing, canClose: () => !isComposing() && (protectedContent || flush() !== null) }), [flush, flushForWrite, protectedContent, isComposing]);
  useEffect(() => {
    if (protectedContent) {
      handleValidityChange(false);
      onValidityChange?.(false);
    }
  }, [handleValidityChange, onValidityChange, protectedContent]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const findFooter = () => setFooterTarget(wrapper.querySelector('[data-slot="milkdown-editor-footer-status"]'));
    findFooter();
    const observer = new MutationObserver(findFooter);
    observer.observe(wrapper, { childList: true });
    return () => observer.disconnect();
  }, [version, contractVersionReady, protectedContent]);
  const charCount = useMemo(() => Array.from(currentContent).length, [currentContent]);
  const editorAriaLabel = ariaLabel ?? placeholder ?? "正文编辑器";
  const charWarning = charCount > MAX_CHARS * 0.9
    ? "text-destructive"
    : charCount > MAX_CHARS * 0.7
      ? "text-warning"
      : "text-muted-foreground";

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "rounded-[var(--radius-control)] border border-border bg-background overflow-hidden",
        disabled && "opacity-60 pointer-events-none",
      )}
      style={{
        "--editor-min-height": `${minHeight}px`,
        "--editor-max-height": `${maxHeight}px`,
      } as React.CSSProperties}
    >
      {contractVersionReady && !protectedContent && (
        <MilkdownEditorHost mentionIdentities={mentionIdentities}
          key={`${version}-${user?.id ?? "guest"}`}
          initialValue={restoredValue ?? ""}
          mediaDisplays={restoredMediaDisplays ?? mediaDisplays}
          markdownContractVersion={markdownContractVersion}
          editorRef={hostRef}
          onValidityChange={handleValidity}
          onChange={handleChange}
          onDocumentChange={handleDocumentChange}
          onCompositionChange={handleCompositionChange}
          onSyncErrorChange={handleSyncError}
          onUploadImage={onUploadImage ? upload : undefined}
          placeholder={placeholder}
          disabled={disabled}
          onOpenDrafts={user ? handleOpenDrafts : undefined}
          maxHeight={maxHeight}
          minHeight={minHeight}
          threadId={threadId}
          diceRolls={diceRolls}
          autoFocus={autoFocus}
          ariaLabel={editorAriaLabel}
        />
      )}
      {footerTarget && createPortal(
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
          </div>, footerTarget)}
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
          saveDisabled={syncError}
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
