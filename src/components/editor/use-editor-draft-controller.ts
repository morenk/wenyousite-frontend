"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import { useSaveDraft } from "@/api/hooks/use-save-draft";
import type { DraftItem } from "@/api/hooks/use-content-drafts";
import { queryKeys } from "@/api/query-keys";
import { useAuth } from "@/lib/auth";
import {
  ACTIVE_MARKDOWN_CONTRACT_VERSION,
  sanitizeMilkdownMarkdown,
} from "@/lib/markdown";
import { useApiMeta } from "@/api/hooks/use-api-meta";
import type { EditorDraftSnapshot } from "@/components/editor/content-drafts-panel";

export type EditorAutoSaveStatus = "idle" | "saving" | "saved" | "error";

/** 编辑器正文草稿、恢复和自动保存状态机。 */
export function useEditorDraftController({
  defaultValue,
  onChange,
  waitForMarkdownCapability = false,
}: {
  defaultValue: string;
  onChange?: (value: string) => void;
  waitForMarkdownCapability?: boolean;
}) {
  const { user } = useAuth();
  const { data: apiMeta, isError: apiMetaError } = useApiMeta();
  const capabilityReady = apiMeta !== undefined || apiMetaError;
  const markdownContractVersion = apiMeta?.markdownContractVersion ?? 0;
  const queryClient = useQueryClient();
  const { mutateAsync: saveDraftAutomatically } = useSaveDraft();
  // Keep the hook's historical synchronous sanitization contract while the
  // capability request is pending. EditorCore does not mount Milkdown until
  // the version-aware value has been applied below.
  const initialValue = waitForMarkdownCapability
    ? defaultValue
    : sanitizeMilkdownMarkdown(defaultValue, {
      markdownContractVersion: ACTIVE_MARKDOWN_CONTRACT_VERSION,
    });
  const [restoredValue, setRestoredValue] = useState(initialValue);
  const [version, setVersion] = useState(0);
  const [currentContent, setCurrentContent] = useState(initialValue);
  const [contractVersionReady, setContractVersionReady] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<EditorAutoSaveStatus>("idle");
  const externalOnChangeRef = useRef(onChange);
  const latestContentRef = useRef(initialValue);
  const autoSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const autoSaveSequenceRef = useRef(0);
  const autoSaveDraftRef = useRef<Pick<DraftItem, "id" | "version"> | undefined>(
    undefined,
  );
  const autoSaveEnabledRef = useRef(false);
  const appliedContractVersionRef = useRef<number | null>(null);

  useEffect(() => {
    externalOnChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!waitForMarkdownCapability && initialValue !== defaultValue) {
      externalOnChangeRef.current?.(initialValue);
    }
  }, [defaultValue, initialValue, waitForMarkdownCapability]);

  useEffect(() => {
    if (!capabilityReady || appliedContractVersionRef.current === markdownContractVersion) {
      return;
    }
    appliedContractVersionRef.current = markdownContractVersion;
    const safeContent = sanitizeMilkdownMarkdown(defaultValue, { markdownContractVersion });
    latestContentRef.current = safeContent;
    setRestoredValue(safeContent);
    setCurrentContent(safeContent);
    setVersion((current) => current + 1);
    setContractVersionReady(true);
    if (safeContent !== initialValue) externalOnChangeRef.current?.(safeContent);
  }, [capabilityReady, defaultValue, initialValue, markdownContractVersion]);

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
    const safeContent = sanitizeMilkdownMarkdown(snapshot.content, { markdownContractVersion });
    latestContentRef.current = safeContent;
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
    if (!autoSaveEnabled) return;
    const content = currentContent;
    if (!content.trim()) return;

    const sequence = ++autoSaveSequenceRef.current;
    const timer = window.setTimeout(() => {
      setAutoSaveStatus("saving");
      autoSaveQueueRef.current = autoSaveQueueRef.current
        .catch(() => undefined)
        .then(() => {
          if (!autoSaveEnabledRef.current) return null;
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
  }, [autoSaveEnabled, currentContent, saveDraftAutomatically]);

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
  };
}
