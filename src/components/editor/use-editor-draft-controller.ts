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
}: {
  defaultValue: string;
  onChange?: (value: string) => void;
  flush?: () => string | null;
  hasEditor?: () => boolean;
  onSyncErrorChange?: (hasError: boolean) => void;
}) {
  const { user } = useAuth();
  const { data: apiMeta, isError: apiMetaError } = useApiMeta();
  const capabilityReady = apiMeta !== undefined || apiMetaError;
  const markdownContractVersion = apiMeta?.markdownContractVersion ?? 0;
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
  const externalOnChangeRef = useRef(onChange);
  const latestContentRef = useRef(initialValue);
  const validRef = useRef(true);
  const [valid, setValid] = useState(true);
  const flushRef = useRef(flush);
  const hasEditorRef = useRef(hasEditor);
  useEffect(() => { hasEditorRef.current = hasEditor; }, [hasEditor]);
  useEffect(() => { flushRef.current = flush; }, [flush]);
  const autoSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const autoSaveSequenceRef = useRef(0);
  const autoSaveDraftRef = useRef<Pick<DraftItem, "id" | "version"> | undefined>(
    undefined,
  );
  const autoSaveEnabledRef = useRef(false);
  const appliedContractVersionRef = useRef<number | null>(null);

  useEffect(() => () => {
    autoSaveEnabledRef.current = false;
    autoSaveSequenceRef.current++;
  }, []);

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
    onSyncErrorChange?.(!nextValid);
    validRef.current = nextValid;
    setValid(nextValid);
    if (!nextValid) {
      autoSaveSequenceRef.current++;
      setAutoSaveStatus("error");
    }
  }, [onSyncErrorChange]);
  const handleSyncError = useCallback((hasError: boolean) => handleValidityChange(!hasError), [handleValidityChange]);

  const handleChange = useCallback(
    (value: string) => {
      latestContentRef.current = value;
      setCurrentContent(value);
      if (autoSaveEnabled) setAutoSaveStatus("idle");
      externalOnChangeRef.current?.(value);
    },
    [autoSaveEnabled],
  );

  const handleRestore = useCallback((snapshot: EditorDraftSnapshot) => {
    if (!assessEditorInput(snapshot.content, markdownContractVersion).edit) {
      toast.error("此草稿包含当前版本无法安全编辑的内容，原草稿和当前输入已保留");
      return;
    }
    const safeContent = sanitizeMilkdownMarkdown(snapshot.content, { markdownContractVersion });
    latestContentRef.current = safeContent;
    setRestoredMediaDisplays(snapshot.mediaDisplays ?? []);
    setRestoredValue(safeContent);
    setCurrentContent(safeContent);
    setVersion((current) => current + 1);
    externalOnChangeRef.current?.(safeContent);
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
    if (!autoSaveEnabled || !valid) return;
    const content = currentContent;
    if (!content.trim()) return;

    const sequence = ++autoSaveSequenceRef.current;
    const timer = window.setTimeout(() => {
      setAutoSaveStatus("saving");
      autoSaveQueueRef.current = autoSaveQueueRef.current
        .catch(() => undefined)
        .then(() => {
          if (!autoSaveEnabledRef.current || !validRef.current || autoSaveSequenceRef.current !== sequence) return null;
          const snapshot = flushRef.current ? flushRef.current() : latestContentRef.current;
          if (snapshot === null || snapshot !== content || !validRef.current || !assessEditorInput(snapshot, markdownContractVersion).edit) return null;
          const currentDraft = autoSaveDraftRef.current;
          return currentDraft
            ? saveDraftAutomatically({
                draftId: currentDraft.id,
                content,
                version: currentDraft.version,
              })
            : saveDraftAutomatically({ content, slot: 1 });
        })
        .then((draft) => {
          if (!draft || !autoSaveEnabledRef.current) return;
          autoSaveDraftRef.current = { id: draft.id, version: draft.version };
          if (autoSaveSequenceRef.current === sequence) setAutoSaveStatus("saved");
        })
        .catch((error) => {
          if (autoSaveSequenceRef.current !== sequence) return;
          setAutoSaveStatus("error");
          autoSaveEnabledRef.current = false;
          setAutoSaveEnabled(false);
          toast.error(getApiErrorMessage(error, "正文草稿自动保存失败"));
        });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [autoSaveEnabled, currentContent, markdownContractVersion, saveDraftAutomatically, valid]);

  const handleAutoSaveChange = useCallback(
    (enabled: boolean, draft?: Pick<DraftItem, "id" | "version">) => {
      autoSaveEnabledRef.current = enabled;
      autoSaveDraftRef.current = enabled ? draft : undefined;
      setAutoSaveEnabled(enabled);
      setAutoSaveStatus("idle");
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
    handleValidityChange,
    handleRestore,
    handleOpenDrafts,
    handleAutoSaveChange,
  };
}
