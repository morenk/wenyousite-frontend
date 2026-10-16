/** Milkdown 编辑器公开壳：草稿、字数与宿主生命周期。 */

"use client";

import type { MentionIdentity } from "@/lib/thread-identity";

import type { MarkdownMediaAudio } from "@/lib/markdown-audio";
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
  audioDraftKey?: string;
  mediaAudios?: readonly MarkdownMediaAudio[];
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
    textColorSupported,
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

  const writeAssessmentRef = useRef<{ content: string; version: number; color: boolean; allowed: boolean } | null>(null);
  const flushForWrite = useCallback(() => {
    if (isComposing()) { toast.error(EDITOR_COMPOSITION_MESSAGE); return null; }
    if (hostRef.current?.hasPendingUpload?.()) { toast.error("请先完成或移除音频上传"); return null; }
    const content = flush();
    if (content === null) return null;
    const cached = writeAssessmentRef.current;
    if (!cached || cached.content !== content || cached.version !== advertisedMarkdownContractVersion || cached.color !== advertisedTextColorSupported) {
      writeAssessmentRef.current = { content, version: advertisedMarkdownContractVersion, color: advertisedTextColorSupported, allowed: assessEditorInput(content, advertisedMarkdownContractVersion, advertisedTextColorSupported).edit };
    }
    return writeAssessmentRef.current!.allowed ? content : null;
  }, [advertisedMarkdownContractVersion, advertisedTextColorSupported, flush, isComposing]);

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

  const protectedContent = useMemo(() => contractVersionReady && !assessEditorInput(restoredValue, markdownContractVersion, textColorSupported).edit, [contractVersionReady, restoredValue, markdownContractVersion, textColorSupported]);
  useImperativeHandle(editorRef, () => ({ flush: flushForWrite, isComposing, getMediaAudios: () => hostRef.current?.getMediaAudios?.() ?? restoredMediaAudios ?? mediaAudios ?? [], getMediaDisplays: () => hostRef.current?.getMediaDisplays?.() ?? restoredMediaDisplays ?? mediaDisplays ?? [], canClose: () => !isComposing() && (protectedContent || flush() !== null) }), [flush, flushForWrite, protectedContent, isComposing, restoredMediaDisplays, mediaDisplays, restoredMediaAudios, mediaAudios]);
