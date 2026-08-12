"use client";

import { useCallback, useReducer, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useCreateSubthread } from "@/api/hooks/use-create-subthread";
import { useUpdateSubthread } from "@/api/hooks/use-update-subthread";
import { useDeleteSubthread } from "@/api/hooks/use-delete-subthread";
import { useReorderSubthreads } from "@/api/hooks/use-reorder-subthreads";
import { useUpsertBody } from "@/api/hooks/use-upsert-body";
import { useUploadImage } from "@/api/hooks/use-upload-image";
import type { UploadImageOptions } from "@/lib/upload-image";
import { hasVisibleMarkdownContent } from "@/lib/markdown";
import { getApiError, getApiErrorMessage } from "@/api/errors";
import type { ThreadDetail, SubthreadDetail } from "@/api/hooks/use-thread-detail";
import type { SubthreadFormData } from "@/components/forms/subthread-form";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import { useConfirm } from "@/components/ui/confirm-provider";

export type ManagementView = "thread" | "subthreads" | "members";
export type SubFormMode =
  | { mode: "create" }
  | { mode: "edit"; sub: SubthreadDetail }
  | null;

interface ManagementState {
  view: ManagementView;
  selectedId: string;
  content: string;
  savedContent: string;
  resetKey: number;
  subFormMode: SubFormMode;
  isSaving: boolean;
  isThreadDirty: boolean;
  isThreadSaving: boolean;
}

type ManagementAction =
  | { type: "view"; view: ManagementView }
  | { type: "select"; id: string; content: string }
  | { type: "content"; content: string }
  | { type: "commit-content"; content: string }
  | { type: "reset-content" }
  | { type: "form"; mode: SubFormMode }
  | { type: "saving"; saving: boolean }
  | { type: "thread-dirty"; dirty: boolean }
  | { type: "thread-saving"; saving: boolean };

function managementReducer(
  state: ManagementState,
  action: ManagementAction,
): ManagementState {
  switch (action.type) {
    case "view":
      return {
        ...state,
        view: action.view,
        isThreadDirty: state.view === "thread" ? false : state.isThreadDirty,
        content: state.view === "subthreads" ? state.savedContent : state.content,
        resetKey: state.view === "subthreads" ? state.resetKey + 1 : state.resetKey,
      };
    case "select":
      return {
        ...state,
        selectedId: action.id,
        content: action.content,
        savedContent: action.content,
        resetKey: state.resetKey + 1,
      };
    case "content":
      return { ...state, content: action.content };
    case "commit-content":
      return {
        ...state,
        content: action.content,
        savedContent: action.content,
        resetKey: state.resetKey + 1,
      };
    case "reset-content":
      return {
        ...state,
        content: state.savedContent,
        resetKey: state.resetKey + 1,
      };
    case "form":
      return { ...state, subFormMode: action.mode };
    case "saving":
      return { ...state, isSaving: action.saving };
    case "thread-dirty":
      return state.isThreadDirty === action.dirty
        ? state
        : { ...state, isThreadDirty: action.dirty };
    case "thread-saving":
      return state.isThreadSaving === action.saving
        ? state
        : { ...state, isThreadSaving: action.saving };
  }
}

interface ControllerOptions {
  thread: ThreadDetail;
  initialView: ManagementView;
  onExit: () => void;
  onRefetch: () => Promise<unknown>;
}

/** 管理页状态机与副作用编排；视图组件只消费状态和事件。 */
export function useManagementPanelController({
  thread,
  initialView,
  onExit,
  onRefetch,
}: ControllerOptions) {
  const { user } = useAuth();
  const permissions = useThreadPermissions();
  const confirmAction = useConfirm();
  const subthreads = thread.subthreads.filter(
    (subthread) => subthread.id !== thread.defaultSubthreadId,
  );
  const initialContent = subthreads[0]?.bodyPost?.content ?? "";
  const [state, dispatch] = useReducer(managementReducer, {
    view: initialView,
    selectedId: subthreads[0]?.id ?? "",
    content: initialContent,
    savedContent: initialContent,
    resetKey: 0,
    subFormMode: null,
    isSaving: false,
    isThreadDirty: false,
    isThreadSaving: false,
  });

  const createSubthread = useCreateSubthread();
  const createSubthreadRequestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const updateSubthread = useUpdateSubthread();
  const deleteSubthread = useDeleteSubthread();
  const reorderSubthreads = useReorderSubthreads();
  const upsertBody = useUpsertBody();
  const uploadImage = useUploadImage();

  const isOwner = permissions.isOwner || user?.id === thread.ownerId;
  const selectedSub = subthreads.find((subthread) => subthread.id === state.selectedId);
  const isSubthreadDirty = Boolean(selectedSub) && state.content !== state.savedContent;
  const isNavigationLocked =
    state.isSaving || state.isThreadSaving || uploadImage.isPending;
  const setThreadDirty = useCallback((dirty: boolean) => {
    dispatch({ type: "thread-dirty", dirty });
  }, [dispatch]);
  const setThreadSaving = useCallback((saving: boolean) => {
    dispatch({ type: "thread-saving", saving });
  }, [dispatch]);

  const hasUnsavedChanges = () => state.view === "thread"
    ? state.isThreadDirty
    : state.view === "subthreads" && isSubthreadDirty;

  const confirmDiscardChanges = async () => {
    if (!hasUnsavedChanges()) return true;
    return confirmAction({
      title: "放弃未保存修改",
      description: "当前修改尚未保存，确定要放弃吗？",
      confirmLabel: "放弃修改",
      destructive: true,
    });
  };

  const handleViewChange = async (nextView: ManagementView) => {
    if (nextView === state.view || isNavigationLocked) return;
    if (!(await confirmDiscardChanges())) return;
    dispatch({ type: "view", view: nextView });
  };

  const handleExit = async () => {
    if (isNavigationLocked || !(await confirmDiscardChanges())) return;
    onExit();
  };

  const handleSelect = async (id: string) => {
    if (id === state.selectedId || isNavigationLocked) return;
    if (isSubthreadDirty && !(await confirmAction({
      title: "切换子贴",
      description: "当前修改尚未保存，确定要放弃吗？",
      confirmLabel: "放弃并切换",
      destructive: true,
    }))) return;
    const subthread = thread.subthreads.find((item) => item.id === id);
    dispatch({ type: "select", id, content: subthread?.bodyPost?.content ?? "" });
  };

  const handleSave = async () => {
    if (!selectedSub) return;
    const content = state.content;
    if (!hasVisibleMarkdownContent(content)) {
      toast.error("请输入正文内容");
      return;
    }
    try {
      dispatch({ type: "saving", saving: true });
      await upsertBody.mutateAsync({
        subthreadId: selectedSub.id,
        threadId: thread.id,
        content,
        version: selectedSub.bodyPost?.version,
      });
      dispatch({ type: "commit-content", content });
      toast.success("正文已保存");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "保存失败，请稍后重试"));
    } finally {
      dispatch({ type: "saving", saving: false });
    }
  };

  const handleCreateSubthread = async (data: SubthreadFormData) => {
    const fingerprint = JSON.stringify({
      threadId: thread.id,
      title: data.title,
      postingPolicy: data.postingPolicy,
    });
    if (createSubthreadRequestRef.current?.fingerprint !== fingerprint) {
      createSubthreadRequestRef.current = { fingerprint, id: crypto.randomUUID() };
    }
    try {
      await createSubthread.mutateAsync({
        threadId: thread.id,
        body: {
          title: data.title,
          postingPolicy: data.postingPolicy,
          clientRequestId: createSubthreadRequestRef.current.id,
        },
      });
      createSubthreadRequestRef.current = null;
      await onRefetch();
      dispatch({ type: "form", mode: null });
      toast.success("子贴已创建");
    } catch {
      toast.error("创建子贴失败");
    }
  };

  const handleUpdateSubthread = async (data: SubthreadFormData) => {
    if (state.subFormMode?.mode !== "edit") return;
    const subthread = state.subFormMode.sub;
    try {
      await updateSubthread.mutateAsync({
        subthreadId: subthread.id,
        body: {
          title: data.title,
          postingPolicy: data.postingPolicy,
          version: subthread.version,
        },
      });
      await onRefetch();
      dispatch({ type: "form", mode: null });
      toast.success("子贴已更新");
    } catch {
      toast.error("更新子贴失败");
    }
  };

  const handleDeleteSubthread = async (subthread: SubthreadDetail) => {
    if (!(await confirmAction({
      title: "删除子贴",
      description: "确定要删除该子贴吗？子贴及其所有楼层将被删除。",
      confirmLabel: "删除",
      destructive: true,
    }))) return;
    try {
      await deleteSubthread.mutateAsync(subthread.id);
      if (state.selectedId === subthread.id) {
        const next = subthreads.find((item) => item.id !== subthread.id);
        dispatch({
          type: "select",
          id: next?.id ?? "",
          content: next?.bodyPost?.content ?? "",
        });
      }
      await onRefetch();
      toast.success("子贴已删除");
    } catch {
      toast.error("删除子贴失败");
    }
  };

  const handleReorder = async (ids: string[]) => {
    try {
      await reorderSubthreads.mutateAsync({
        threadId: thread.id,
        ids: [thread.defaultSubthreadId, ...ids],
      });
      await onRefetch();
    } catch (error) {
      const apiError = getApiError(error);
      toast.error(
        apiError.message?.includes("默认子贴") || apiError.message?.includes("第一位")
          ? "主帖必须保持在第一位，不能与其他子帖交换顺序"
          : "排序保存失败，请稍后重试",
      );
    }
  };

  return {
    ...state,
    subthreads,
    selectedSub,
    isOwner,
    isCollaborator: permissions.isCollaborator,
    isSubthreadDirty,
    isNavigationLocked,
    createPending: createSubthread.isPending,
    updatePending: updateSubthread.isPending,
    setContent: (content: string) => dispatch({ type: "content", content }),
    setSubFormMode: (mode: SubFormMode) => dispatch({ type: "form", mode }),
    setThreadDirty,
    setThreadSaving,
    resetSubthreadEditor: () => dispatch({ type: "reset-content" }),
    uploadImage: (file: File, options?: UploadImageOptions) => uploadImage.mutateAsync(file, options),
    handleViewChange,
    handleExit,
    handleSelect,
    handleSave,
    handleCreateSubthread,
    handleUpdateSubthread,
    handleDeleteSubthread,
    handleReorder,
  };
}
