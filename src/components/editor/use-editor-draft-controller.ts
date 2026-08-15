"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import { useSaveDraft } from "@/api/hooks/use-save-draft";
import { queryKeys } from "@/api/query-keys";
import { useAuth } from "@/lib/auth";
import { sanitizeMilkdownMarkdown } from "@/lib/markdown";
import type { EditorDraftSnapshot } from "@/components/editor/content-drafts-panel";

export type EditorAutoSaveStatus = "idle" | "saving" | "saved" | "error";

/** 编辑器正文草稿、恢复和自动保存状态机。 */
export function useEditorDraftController({
  defaultValue,
  onChange,
}: {
  defaultValue: string;
  onChange?: (value: string) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { mutateAsync: saveDraftAutomatically } = useSaveDraft();
  const initialValue = sanitizeMilkdownMarkdown(defaultValue);
  const [restoredValue, setRestoredValue] = useState(initialValue);
  const [version, setVersion] = useState(0);
  const [currentContent, setCurrentContent] = useState(initialValue);
  const [draftOpen, setDraftOpen] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<EditorAutoSaveStatus>("idle");
  const externalOnChangeRef = useRef(onChange);
  const latestContentRef = useRef(initialValue);
  const autoSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const autoSaveSequenceRef = useRef(0);
  const autoSaveVersionRef = useRef<number | undefined>(undefined);
  const autoSaveEnabledRef = useRef(false);

  useEffect(() => {
    externalOnChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (initialValue !== defaultValue) externalOnChangeRef.current?.(initialValue);
  }, [defaultValue, initialValue]);

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
    const safeContent = sanitizeMilkdownMarkdown(snapshot.content);
    latestContentRef.current = safeContent;
    setRestoredValue(safeContent);
    setCurrentContent(safeContent);
    setVersion((current) => current + 1);
    externalOnChangeRef.current?.(safeContent);
    toast.success("已恢复正文草稿");
  }, []);

  const handleOpenDrafts = useCallback(() => {
    setDraftOpen(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    const refreshDrafts = () => {
      void queryClient.refetchQueries({ queryKey: queryKeys.contentDrafts });
      void queryClient.refetchQueries({ queryKey: queryKeys.draftSlots });
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
          return saveDraftAutomatically({
            content,
            slot: 1,
            ...(autoSaveVersionRef.current !== undefined
              ? { version: autoSaveVersionRef.current }
              : {}),
          });
        })
        .then((draft) => {
          if (!draft || !autoSaveEnabledRef.current) return;
          autoSaveVersionRef.current = draft.version;
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

  const handleAutoSaveChange = useCallback((enabled: boolean, draftVersion?: number) => {
    autoSaveEnabledRef.current = enabled;
    autoSaveVersionRef.current = enabled ? draftVersion : undefined;
    setAutoSaveEnabled(enabled);
    setAutoSaveStatus("idle");
  }, []);

  return {
    user,
    restoredValue,
    version,
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
