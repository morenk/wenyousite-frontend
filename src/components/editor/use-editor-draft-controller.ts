"use client";

import type { MarkdownMediaDisplay } from "@/lib/media-display";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import { useSaveDraft } from "@/api/hooks/use-save-draft";
import type { DraftItem } from "@/api/hooks/use-content-drafts";
import { queryKeys } from "@/api/query-keys";
import { useAuth } from "@/lib/auth";
import {
  sanitizeMilkdownMarkdown,
} from "@/lib/markdown";
import { assessEditorInput } from "@/lib/editor-content-compatibility";
import { useApiMeta } from "@/api/hooks/use-api-meta";
import type { EditorDraftSnapshot } from "@/components/editor/content-drafts-panel";

export type EditorAutoSaveStatus = "idle" | "saving" | "saved" | "error";

/** 编辑器正文草稿、恢复和自动保存状态机。 */
export function useEditorDraftController({
  defaultValue,
  onChange,
  flush,
  hasEditor,
  onSyncErrorChange,
  isComposing,
  onDocumentChange,
}: {
  defaultValue: string;
  onChange?: (value: string) => void;
  flush?: () => string | null;
  hasEditor?: () => boolean;
  onSyncErrorChange?: (hasError: boolean) => void;
  isComposing?: () => boolean;
  onDocumentChange?: () => void;
}) {
  const { user } = useAuth();
  const { data: apiMeta, isError: apiMetaError } = useApiMeta();
  const capabilityReady = apiMeta !== undefined || apiMetaError;
  const advertisedVersion = apiMeta?.markdownContractVersion ?? 0;
  // v6是独立能力，不以全局版本号推断角色协议支持。
  const markdownContractVersion = apiMeta?.capabilities?.roleMentionsV6Supported ? 6 : advertisedVersion === 6 ? 0 : advertisedVersion;
  const queryClient = useQueryClient();
  const { mutateAsync: saveDraftAutomatically } = useSaveDraft();
  const initialValue = defaultValue;
  const [restoredMediaDisplays, setRestoredMediaDisplays] = useState<readonly MarkdownMediaDisplay[] | undefined>();
  const [restoredValue, setRestoredValue] = useState(initialValue);
  const [version, setVersion] = useState(0);
  const [currentContent, setCurrentContent] = useState(initialValue);
  const [activeMarkdownContractVersion, setActiveMarkdownContractVersion] = useState(0);
  const [contractVersionReady, setContractVersionReady] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<EditorAutoSaveStatus>("idle");
  const [autoSaveUserId, setAutoSaveUserId] = useState(user?.id);
  // 账号变更的呈现状态在提交新 render 前重置，旧队列另由 effect 同步失效。
  if (autoSaveUserId !== user?.id) {
    setAutoSaveUserId(user?.id);
    setAutoSaveEnabled(false);
    setAutoSaveStatus("idle");
  }
  const externalOnChangeRef = useRef(onChange);
  const externalSyncErrorRef = useRef(onSyncErrorChange);
  useEffect(() => { externalSyncErrorRef.current = onSyncErrorChange; }, [onSyncErrorChange]);
  const latestContentRef = useRef(initialValue);
  const validRef = useRef(true);
  const [valid, setValid] = useState(true);
  const flushRef = useRef(flush);
  const hasEditorRef = useRef(hasEditor);
  useEffect(() => { hasEditorRef.current = hasEditor; }, [hasEditor]);
  useEffect(() => { flushRef.current = flush; }, [flush]);
  const autoSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const autoSaveSequenceRef = useRef(0);
  const autoSaveSessionRef = useRef(0);
  const autoSaveDraftRef = useRef<Pick<DraftItem, "id" | "version"> | undefined>(
    undefined,
  );
  const autoSaveEnabledRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastEditRef = useRef(0);
  const awaitingSnapshotRef = useRef(false);
  const composingRef = useRef(false);
  const scheduleAutoSaveRef = useRef<(() => void) | null>(null);
  const callbacksRef = useRef({ isComposing, onDocumentChange });
  useEffect(() => { callbacksRef.current = { isComposing, onDocumentChange }; }, [isComposing, onDocumentChange]);
  const handleDocumentChange = useCallback(() => {
    clearTimeout(autoSaveTimerRef.current);
    autoSaveSequenceRef.current++;
    lastEditRef.current = Date.now();
    awaitingSnapshotRef.current = true;
    callbacksRef.current.onDocumentChange?.();
    scheduleAutoSaveRef.current?.();
  }, []);
  const handleCompositionChange = useCallback((composing: boolean) => {
    composingRef.current = composing;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveSequenceRef.current++;
    if (!composing) scheduleAutoSaveRef.current?.();
  }, []);
  const appliedContractVersionRef = useRef<number | null>(null);

  const cancelAutoSaveSession = useCallback(() => {
    autoSaveEnabledRef.current = false;
    autoSaveSessionRef.current++;
    autoSaveSequenceRef.current++;
    clearTimeout(autoSaveTimerRef.current);
  }, []);
  useEffect(() => {
    autoSaveDraftRef.current = undefined;
    composingRef.current = false;
    awaitingSnapshotRef.current = false;
    lastEditRef.current = Date.now();
    return cancelAutoSaveSession;
  }, [user?.id, cancelAutoSaveSession]);

  useEffect(() => {
    externalOnChangeRef.current = onChange;
  }, [onChange]);


  useEffect(() => {
    if (!capabilityReady || appliedContractVersionRef.current === markdownContractVersion) {
      return;
    }
    let source = latestContentRef.current;
    if (appliedContractVersionRef.current !== null && hasEditorRef.current?.()) {
      const current = flushRef.current?.();
      if (current === null || current === undefined) return;
      source = current;
    }
    const safeContent = assessEditorInput(source, markdownContractVersion).edit
      ? sanitizeMilkdownMarkdown(source, { markdownContractVersion }) : source;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveSequenceRef.current++;
    appliedContractVersionRef.current = markdownContractVersion;
    latestContentRef.current = safeContent;
    setRestoredValue(safeContent);
    setCurrentContent(safeContent);
    setVersion((current) => current + 1);
    setActiveMarkdownContractVersion(markdownContractVersion);
    setContractVersionReady(true);
    if (safeContent !== initialValue) externalOnChangeRef.current?.(safeContent);
  }, [capabilityReady, defaultValue, initialValue, markdownContractVersion, valid]);

  const handleValidityChange = useCallback((nextValid: boolean) => {
    externalSyncErrorRef.current?.(!nextValid);
    validRef.current = nextValid;
    setValid(nextValid);
    if (!nextValid) {
      autoSaveSequenceRef.current++;
      setAutoSaveStatus("error");
    }
  }, []);
  const handleSyncError = useCallback((hasError: boolean) => handleValidityChange(!hasError), [handleValidityChange]);

  const handleChange = useCallback(
    (value: string) => {
      // 旧调用方可只通知快照；真实宿主的计时由即时文档通知维护。
      if (!awaitingSnapshotRef.current) {
        autoSaveSequenceRef.current++;
        lastEditRef.current = Date.now();
      }
      awaitingSnapshotRef.current = false;
      latestContentRef.current = value;
      setCurrentContent(value);
      if (autoSaveEnabledRef.current) setAutoSaveStatus("idle");
      externalOnChangeRef.current?.(value);
    },
    [],
  );

  const handleRestore = useCallback((snapshot: EditorDraftSnapshot) => {
    if (composingRef.current || callbacksRef.current.isComposing?.()) {
      toast.error("请先完成输入法选词，再恢复草稿");
      return;
    }
    if (hasEditorRef.current?.() && flushRef.current?.() === null) return;
    if (!assessEditorInput(snapshot.content, markdownContractVersion).edit) {
      toast.error("此草稿包含当前版本无法安全编辑的内容，原草稿和当前输入已保留");
      return;
    }
    clearTimeout(autoSaveTimerRef.current);
    autoSaveSequenceRef.current++;
    lastEditRef.current = Date.now();
    awaitingSnapshotRef.current = false;
    const safeContent = sanitizeMilkdownMarkdown(snapshot.content, { markdownContractVersion });
    latestContentRef.current = safeContent;
    setRestoredMediaDisplays(snapshot.mediaDisplays ?? []);
    setRestoredValue(safeContent);
    setCurrentContent(safeContent);
    setVersion((current) => current + 1);
    externalOnChangeRef.current?.(safeContent);
    scheduleAutoSaveRef.current?.();
    toast.success("已恢复正文草稿");
  }, [markdownContractVersion]);

  const handleOpenDrafts = useCallback(() => {
    setDraftOpen(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    const refreshDrafts = () => {
      void queryClient.refetchQueries({ queryKey: queryKeys.draftState });
    };
    window.addEventListener("focus", refreshDrafts);
    return () => window.removeEventListener("focus", refreshDrafts);
  }, [queryClient, user]);

  useEffect(() => {
    const schedule = () => {
      clearTimeout(autoSaveTimerRef.current);
      if (!autoSaveEnabledRef.current || !validRef.current || composingRef.current) return;
      const sequence = autoSaveSequenceRef.current;
      const session = autoSaveSessionRef.current;
      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveQueueRef.current = autoSaveQueueRef.current
          .catch(() => undefined)
          .then(() => {
            if (!autoSaveEnabledRef.current || !validRef.current || autoSaveSequenceRef.current !== sequence
              || composingRef.current || callbacksRef.current.isComposing?.()) return null;
            const content = flushRef.current ? flushRef.current() : latestContentRef.current;
            if (content === null || !content.trim() || !validRef.current
              || autoSaveSequenceRef.current !== sequence
              || !assessEditorInput(content, markdownContractVersion).edit) return null;
            setAutoSaveStatus("saving");
            const currentDraft = autoSaveDraftRef.current;
            return currentDraft
              ? saveDraftAutomatically({ draftId: currentDraft.id, content, version: currentDraft.version })
              : saveDraftAutomatically({ content, slot: 1 });
          })
          .then((draft) => {
            if (!draft || !autoSaveEnabledRef.current || autoSaveSessionRef.current !== session) return;
            // 已发请求即使晚于新输入，也必须推进同一草稿版本；不得覆盖输入状态。
            autoSaveDraftRef.current = { id: draft.id, version: draft.version };
            if (autoSaveSequenceRef.current === sequence) setAutoSaveStatus("saved");
          })
          .catch((error) => {
            if (autoSaveSequenceRef.current !== sequence || autoSaveSessionRef.current !== session) return;
            setAutoSaveStatus("error");
            autoSaveEnabledRef.current = false;
            setAutoSaveEnabled(false);
            toast.error(getApiErrorMessage(error, "正文草稿自动保存失败"));
          });
      }, Math.max(0, 800 - (Date.now() - lastEditRef.current)));
    };
    scheduleAutoSaveRef.current = schedule;
    schedule();
    return () => {
      clearTimeout(autoSaveTimerRef.current);
      scheduleAutoSaveRef.current = null;
    };
  }, [autoSaveEnabled, currentContent, markdownContractVersion, saveDraftAutomatically, valid]);

  const handleAutoSaveChange = useCallback(
    (enabled: boolean, draft?: Pick<DraftItem, "id" | "version">) => {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveSequenceRef.current++;
      lastEditRef.current = Date.now();
      autoSaveSessionRef.current++;
      autoSaveEnabledRef.current = enabled;
      autoSaveDraftRef.current = enabled ? draft : undefined;
      setAutoSaveEnabled(enabled);
      setAutoSaveStatus("idle");
      scheduleAutoSaveRef.current?.();
    },
    [],
  );

  return {
    syncError: !valid,
    handleSyncError,
    user,
    markdownContractVersion: activeMarkdownContractVersion,
    advertisedMarkdownContractVersion: markdownContractVersion,
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
    handleValidityChange,
    handleRestore,
    handleOpenDrafts,
    handleAutoSaveChange,
  };
}
