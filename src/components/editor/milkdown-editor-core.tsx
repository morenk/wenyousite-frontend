/** Milkdown 编辑器公开壳：草稿、字数与宿主生命周期。 */

"use client";

import type { MilkdownEditorProps } from "./milkdown-editor-types";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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
const AUTO_SAVE_LABELS = { idle: "等待编辑", saving: "保存中", saved: "已保存", error: "保存失败" } as const;

export type { MilkdownEditorProps } from "./milkdown-editor-types";

function EditorCore({
  defaultValue,
  allowTextColor = false,
  allowTextFont = false,
  audioDraftKey,
  mediaAudios,
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
    textFontSupported,
    textFontWriteEnabled,
    advertisedTextFontSupported,
    textColorSupported,
    textColorWriteEnabled,
    advertisedTextColorSupported,
    user,
    restoredValue,
    restoredMediaDisplays,
    restoredMediaAudios,
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

  const writeAssessmentRef = useRef<{ content: string; version: number; color: boolean; font: boolean | 2; allowed: boolean } | null>(null);
  const flushForWrite = useCallback(() => {
    if (isComposing()) { toast.error(EDITOR_COMPOSITION_MESSAGE); return null; }
    if (hostRef.current?.hasPendingUpload?.()) { toast.error("请先完成或移除音频上传"); return null; }
    const content = flush();
    if (content === null) return null;
    const cached = writeAssessmentRef.current;
    if (!cached || cached.content !== content || cached.version !== advertisedMarkdownContractVersion || cached.color !== advertisedTextColorSupported || cached.font !== advertisedTextFontSupported) {
      writeAssessmentRef.current = { content, version: advertisedMarkdownContractVersion, color: advertisedTextColorSupported, font: advertisedTextFontSupported, allowed: assessEditorInput(content, advertisedMarkdownContractVersion, advertisedTextColorSupported, advertisedTextFontSupported).edit };
    }
    return writeAssessmentRef.current!.allowed ? content : null;
  }, [advertisedMarkdownContractVersion, advertisedTextColorSupported, advertisedTextFontSupported, flush, isComposing]);

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

  const protectedContent = useMemo(() => contractVersionReady && !assessEditorInput(restoredValue, markdownContractVersion, textColorSupported, textFontSupported).edit, [contractVersionReady, restoredValue, markdownContractVersion, textColorSupported, textFontSupported]);
  useImperativeHandle(editorRef, () => ({ flush: flushForWrite, isComposing, getMediaAudios: () => hostRef.current?.getMediaAudios?.() ?? restoredMediaAudios ?? mediaAudios ?? [], getMediaDisplays: () => hostRef.current?.getMediaDisplays?.() ?? restoredMediaDisplays ?? mediaDisplays ?? [], canClose: () => !isComposing() && (protectedContent || flush() !== null) }), [flush, flushForWrite, protectedContent, isComposing, restoredMediaDisplays, mediaDisplays, restoredMediaAudios, mediaAudios]);
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
          audioDraftKey={audioDraftKey} audioUserId={user?.id}
          key={`${version}-${user?.id ?? "guest"}`}
          initialValue={restoredValue ?? ""}
          mediaDisplays={restoredMediaDisplays ?? mediaDisplays}
          mediaAudios={restoredMediaAudios ?? mediaAudios}
          markdownContractVersion={markdownContractVersion}
          textFontVersion={textFontSupported === 2 ? 2 : textFontSupported ? 1 : undefined}
          textFontRenderingEnabled={allowTextFont && Boolean(textFontSupported)}
          textFontWriteEnabled={allowTextFont && textFontWriteEnabled}
          textColorVersion={textColorSupported ? 1 : undefined}
          textColorWriteEnabled={allowTextColor && textColorWriteEnabled}
          textColorAccountId={user?.id}
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
                {AUTO_SAVE_LABELS[autoSaveStatus]}
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
