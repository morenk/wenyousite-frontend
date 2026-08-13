"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useQueryStates } from "nuqs";
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
import {
  API_ERROR_CODE,
  getApiError,
  getApiErrorMessage,
} from "@/api/errors";
import type { ThreadDetail, SubthreadDetail } from "@/api/hooks/use-thread-detail";
import type { SubthreadFormData } from "@/components/forms/subthread-form";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  SAVED_MANAGEMENT_STATUS,
  type ManagementEditorStatus,
} from "@/components/thread/management-types";
import {
  managementUrlParsers,
  type ManagementView,
} from "@/lib/management-url-state";

export type { ManagementView } from "@/lib/management-url-state";

export type SubFormMode = { mode: "create" } | null;

type PostingPolicy = SubthreadDetail["postingPolicy"];

interface ManagementState {
  selectedId: string;
  title: string;
  savedTitle: string;
  postingPolicy: PostingPolicy;
  savedPostingPolicy: PostingPolicy;
  content: string;
  savedContent: string;
  metaVersion?: number;
  bodyVersion?: number;
  resetKey: number;
  focusRequestKey: number;
  subFormMode: SubFormMode;
  subthreadStatus: ManagementEditorStatus;
  threadStatus: ManagementEditorStatus;
  orderedIds: string[];
  transientSubthreads: SubthreadDetail[];
  isReordering: boolean;
}

type ManagementAction =
  | { type: "hydrate"; subthread?: SubthreadDetail; focus?: boolean; remember?: boolean }
  | { type: "title"; title: string }
  | { type: "posting-policy"; postingPolicy: PostingPolicy }
  | { type: "content"; content: string }
  | { type: "commit-meta"; title: string; postingPolicy: PostingPolicy; version?: number }
  | { type: "commit-content"; content: string; version?: number }
  | { type: "reset-subthread" }
  | { type: "subthread-status"; status: ManagementEditorStatus }
  | { type: "thread-status"; status: ManagementEditorStatus }
  | { type: "form"; mode: SubFormMode }
  | { type: "sync-order"; ids: string[] }
  | { type: "order"; ids: string[]; saving: boolean }
  | { type: "finish-order"; ids: string[]; status: ManagementEditorStatus };

function getInitialSubthread(
  subthreads: SubthreadDetail[],
  requestedId: string | null,
) {
  return subthreads.find((subthread) => subthread.id === requestedId) ?? subthreads[0];
}

function getSubthreadStatus(state: ManagementState): ManagementEditorStatus {
  const dirty =
    state.title !== state.savedTitle ||
    state.postingPolicy !== state.savedPostingPolicy ||
    state.content !== state.savedContent;
  if (!dirty) return SAVED_MANAGEMENT_STATUS;
  if (state.subthreadStatus.state === "conflict") {
    return { ...state.subthreadStatus, dirty: true };
  }
  if (state.subthreadStatus.state === "error") {
    return { ...state.subthreadStatus, dirty: true };
  }
  return { state: "dirty", dirty: true, busy: false };
}

function managementReducer(
  state: ManagementState,
  action: ManagementAction,
): ManagementState {
  switch (action.type) {
    case "hydrate": {
      const subthread = action.subthread;
      const transientSubthreads = action.remember && subthread
        ? [
            ...state.transientSubthreads.filter((item) => item.id !== subthread.id),
            subthread,
          ]
        : state.transientSubthreads;
      return {
        ...state,
        selectedId: subthread?.id ?? "",
        title: subthread?.title ?? "",
        savedTitle: subthread?.title ?? "",
        postingPolicy: subthread?.postingPolicy ?? "PARTICIPANTS",
        savedPostingPolicy: subthread?.postingPolicy ?? "PARTICIPANTS",
        content: subthread?.bodyPost?.content ?? "",
        savedContent: subthread?.bodyPost?.content ?? "",
        metaVersion: subthread?.version,
        bodyVersion: subthread?.bodyPost?.version,
        resetKey: state.resetKey + 1,
        focusRequestKey: action.focus ? state.focusRequestKey + 1 : state.focusRequestKey,
        subthreadStatus: SAVED_MANAGEMENT_STATUS,
        transientSubthreads,
      };
    }
    case "title":
      return { ...state, title: action.title, subthreadStatus: { state: "dirty", dirty: true, busy: false } };
    case "posting-policy":
      return {
        ...state,
        postingPolicy: action.postingPolicy,
        subthreadStatus: { state: "dirty", dirty: true, busy: false },
      };
    case "content":
      return {
        ...state,
        content: action.content,
        subthreadStatus: state.subthreadStatus.state === "conflict"
          ? { ...state.subthreadStatus, dirty: true }
          : { state: "dirty", dirty: true, busy: false },
      };
    case "commit-meta":
      return {
        ...state,
        title: action.title,
        savedTitle: action.title,
        postingPolicy: action.postingPolicy,
        savedPostingPolicy: action.postingPolicy,
        metaVersion: action.version ?? state.metaVersion,
      };
    case "commit-content":
      return {
        ...state,
        content: action.content,
        savedContent: action.content,
        bodyVersion: action.version ?? state.bodyVersion,
      };
    case "reset-subthread":
      return {
        ...state,
        title: state.savedTitle,
        postingPolicy: state.savedPostingPolicy,
        content: state.savedContent,
        resetKey: state.resetKey + 1,
        subthreadStatus: SAVED_MANAGEMENT_STATUS,
      };
    case "subthread-status":
      return { ...state, subthreadStatus: action.status };
    case "thread-status":
      return { ...state, threadStatus: action.status };
    case "form":
      return { ...state, subFormMode: action.mode };
    case "sync-order":
      return {
        ...state,
        orderedIds: state.orderedIds.join() === action.ids.join()
          ? state.orderedIds
          : action.ids,
        transientSubthreads: state.transientSubthreads.filter(
          (item) => !action.ids.includes(item.id),
        ),
      };
    case "order":
      return {
        ...state,
        orderedIds: action.ids,
        isReordering: action.saving,
        subthreadStatus: action.saving && !getSubthreadStatus(state).dirty
          ? { state: "saving", dirty: false, busy: true, message: "正在保存排序…" }
          : state.subthreadStatus,
      };
    case "finish-order":
      return {
        ...state,
        orderedIds: action.ids,
        isReordering: false,
        subthreadStatus: getSubthreadStatus(state).dirty
          ? state.subthreadStatus
          : action.status,
      };
  }
}

interface ControllerOptions {
  thread: ThreadDetail;
  onExit: () => void;
  onRefetch: () => Promise<ThreadDetail | undefined>;
}

/** 桌面管理工作台的 URL 状态、编辑基线与写操作编排。 */
export function useManagementPanelController({
  thread,
  onExit,
  onRefetch,
}: ControllerOptions) {
  const { user } = useAuth();
  const permissions = useThreadPermissions();
  const confirmAction = useConfirm();
  const [{ view, subthread: requestedSubthreadId }, setUrlState] = useQueryStates(
    managementUrlParsers,
    { history: "replace", shallow: true, clearOnDefault: true },
  );
  const sourceSubthreads = useMemo(
    () => thread.subthreads.filter((item) => item.id !== thread.defaultSubthreadId),
    [thread.defaultSubthreadId, thread.subthreads],
  );
  const initialSubthread = getInitialSubthread(sourceSubthreads, requestedSubthreadId);
  const [state, dispatch] = useReducer(managementReducer, {
    selectedId: initialSubthread?.id ?? "",
    title: initialSubthread?.title ?? "",
    savedTitle: initialSubthread?.title ?? "",
    postingPolicy: initialSubthread?.postingPolicy ?? "PARTICIPANTS",
    savedPostingPolicy: initialSubthread?.postingPolicy ?? "PARTICIPANTS",
    content: initialSubthread?.bodyPost?.content ?? "",
    savedContent: initialSubthread?.bodyPost?.content ?? "",
    metaVersion: initialSubthread?.version,
    bodyVersion: initialSubthread?.bodyPost?.version,
    resetKey: 0,
    focusRequestKey: 0,
    subFormMode: null,
    subthreadStatus: SAVED_MANAGEMENT_STATUS,
    threadStatus: SAVED_MANAGEMENT_STATUS,
    orderedIds: sourceSubthreads.map((item) => item.id),
    transientSubthreads: [],
    isReordering: false,
  });

  const createSubthread = useCreateSubthread();
  const createSubthreadRequestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const allowWindowNavigationRef = useRef(false);
  const updateSubthread = useUpdateSubthread();
  const deleteSubthread = useDeleteSubthread();
  const reorderSubthreads = useReorderSubthreads();
  const upsertBody = useUpsertBody();
  const uploadImage = useUploadImage();

  const isOwner = permissions.isOwner || user?.id === thread.ownerId;
  const availableSubthreads = useMemo(() => {
    const sourceIds = new Set(sourceSubthreads.map((item) => item.id));
    return [
      ...sourceSubthreads,
      ...state.transientSubthreads.filter((item) => !sourceIds.has(item.id)),
    ];
  }, [sourceSubthreads, state.transientSubthreads]);
  const subthreadMap = useMemo(
    () => new Map(availableSubthreads.map((item) => [item.id, item])),
    [availableSubthreads],
  );
  const subthreads = useMemo(() => {
    const ordered = state.orderedIds
      .map((id) => subthreadMap.get(id))
      .filter((item): item is SubthreadDetail => Boolean(item));
    const known = new Set(ordered.map((item) => item.id));
    return [...ordered, ...availableSubthreads.filter((item) => !known.has(item.id))];
  }, [availableSubthreads, state.orderedIds, subthreadMap]);
  const selectedSub = subthreadMap.get(state.selectedId);
  const effectiveSubthreadStatus = getSubthreadStatus(state);
  const currentStatus = view === "settings"
    ? state.threadStatus
    : view === "subthreads"
      ? effectiveSubthreadStatus
      : SAVED_MANAGEMENT_STATUS;
  const hasUnsavedChanges = currentStatus.dirty;
  const isNavigationLocked =
    currentStatus.busy ||
    state.isReordering ||
    uploadImage.isPending ||
    createSubthread.isPending ||
    deleteSubthread.isPending;

  useEffect(() => {
    if (state.isReordering) return;
    dispatch({ type: "sync-order", ids: sourceSubthreads.map((item) => item.id) });
  }, [sourceSubthreads, state.isReordering]);

  useEffect(() => {
    if (view !== "subthreads") {
      if (requestedSubthreadId) void setUrlState({ subthread: null });
      return;
    }
    const requested = getInitialSubthread(availableSubthreads, requestedSubthreadId);
    if (!requested) {
      if (requestedSubthreadId) void setUrlState({ subthread: null });
      if (state.selectedId) dispatch({ type: "hydrate" });
      return;
    }
    if (requested.id !== requestedSubthreadId) {
      void setUrlState({ subthread: requested.id });
    }
    if (requested.id !== state.selectedId && !effectiveSubthreadStatus.dirty) {
      dispatch({ type: "hydrate", subthread: requested });
    }
  }, [
    effectiveSubthreadStatus.dirty,
    requestedSubthreadId,
    setUrlState,
    availableSubthreads,
    state.selectedId,
    view,
  ]);

  const setThreadStatus = useCallback((status: ManagementEditorStatus) => {
    dispatch({ type: "thread-status", status });
  }, []);

  const confirmDiscardChanges = useCallback(async () => {
    if (!hasUnsavedChanges) return true;
    return confirmAction({
      title: "放弃未保存修改",
      description: "当前修改尚未保存，确定要放弃吗？",
      confirmLabel: "放弃修改",
      destructive: true,
    });
  }, [confirmAction, hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges && !isNavigationLocked) return;
    allowWindowNavigationRef.current = false;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowWindowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;
      const target = event.target;
      const anchor = target instanceof Element
        ? target.closest<HTMLAnchorElement>("a[href]")
        : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.href === window.location.href ||
        (destination.pathname === window.location.pathname &&
          destination.search === window.location.search &&
          destination.hash)
      ) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isNavigationLocked) return;
      void confirmDiscardChanges().then((confirmed) => {
        if (!confirmed) return;
        allowWindowNavigationRef.current = true;
        window.location.assign(destination.href);
      });
    };
    const handlePopState = () => {
      if (allowWindowNavigationRef.current) return;
      window.history.forward();
      if (isNavigationLocked) return;
      void confirmDiscardChanges().then((confirmed) => {
        if (!confirmed) return;
        allowWindowNavigationRef.current = true;
        window.history.back();
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [confirmDiscardChanges, hasUnsavedChanges, isNavigationLocked]);

  const handleViewChange = async (nextView: ManagementView) => {
    if (nextView === view || isNavigationLocked) return;
    if (!(await confirmDiscardChanges())) return;
    if (view === "subthreads") dispatch({ type: "reset-subthread" });
    await setUrlState({
      view: nextView,
      subthread: nextView === "subthreads" ? state.selectedId || null : null,
    });
  };

  const handleExit = async () => {
    if (isNavigationLocked || !(await confirmDiscardChanges())) return;
    onExit();
  };

  const handleSelect = async (id: string) => {
    if (id === state.selectedId || isNavigationLocked) return;
    if (effectiveSubthreadStatus.dirty && !(await confirmAction({
      title: "切换子贴",
      description: "当前子贴的修改尚未保存，确定要放弃并切换吗？",
      confirmLabel: "放弃并切换",
      destructive: true,
    }))) return;
    const next = subthreadMap.get(id);
    dispatch({ type: "hydrate", subthread: next });
    await setUrlState({ view: "subthreads", subthread: id });
  };

  const handleSaveSubthread = async () => {
    if (!selectedSub || !effectiveSubthreadStatus.dirty || isNavigationLocked) return;
    const title = state.title.trim();
    const metaDirty =
      title !== state.savedTitle || state.postingPolicy !== state.savedPostingPolicy;
    const contentDirty = state.content !== state.savedContent;
    if (!title) {
      dispatch({
        type: "subthread-status",
        status: { state: "error", dirty: true, busy: false, message: "请输入子贴标题" },
      });
      return;
    }
    if (title.length > 100) {
      dispatch({
        type: "subthread-status",
        status: { state: "error", dirty: true, busy: false, message: "子贴标题最多 100 个字符" },
      });
      return;
    }
    if (contentDirty && !hasVisibleMarkdownContent(state.content)) {
      dispatch({
        type: "subthread-status",
        status: { state: "error", dirty: true, busy: false, message: "正文不能为空" },
      });
      return;
    }

    dispatch({
      type: "subthread-status",
      status: { state: "saving", dirty: true, busy: true },
    });
    let savedPart = false;
    try {
      if (metaDirty) {
        const updated = await updateSubthread.mutateAsync({
          subthreadId: selectedSub.id,
          body: {
            title,
            postingPolicy: state.postingPolicy,
            version: state.metaVersion ?? selectedSub.version,
          },
        });
        dispatch({
          type: "commit-meta",
          title,
          postingPolicy: state.postingPolicy,
          version: updated.version,
        });
        savedPart = true;
      }
      if (contentDirty) {
        const updatedBody = await upsertBody.mutateAsync({
          subthreadId: selectedSub.id,
          threadId: thread.id,
          content: state.content,
          version: state.bodyVersion,
        });
        dispatch({
          type: "commit-content",
          content: state.content,
          version: updatedBody.version,
        });
        savedPart = true;
      }
      dispatch({ type: "subthread-status", status: SAVED_MANAGEMENT_STATUS });
      await onRefetch();
      toast.success("子贴修改已保存");
    } catch (error) {
      const apiError = getApiError(error);
      const conflict = apiError.code === API_ERROR_CODE.OPTIMISTIC_LOCK_CONFLICT;
      dispatch({
        type: "subthread-status",
        status: {
          state: conflict ? "conflict" : "error",
          dirty: true,
          busy: false,
          message: conflict
            ? "内容已被其他管理者修改，请保留本地正文后载入最新版本。"
            : savedPart
              ? "部分修改已保存，其余内容保存失败，请重试。"
              : getApiErrorMessage(error, "保存失败，请稍后重试"),
        },
      });
      toast.error(
        conflict
          ? "内容版本冲突，本地修改仍保留"
          : savedPart
            ? "部分修改已保存"
            : getApiErrorMessage(error, "保存失败，请稍后重试"),
      );
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
      const created = await createSubthread.mutateAsync({
        threadId: thread.id,
        body: {
          title: data.title,
          postingPolicy: data.postingPolicy,
          clientRequestId: createSubthreadRequestRef.current.id,
        },
      });
      createSubthreadRequestRef.current = null;
      const refreshed = await onRefetch();
      const next = refreshed?.subthreads.find((item) => item.id === created.id) ?? {
        ...created,
        bodyPost: null,
      } as SubthreadDetail;
      dispatch({ type: "form", mode: null });
      dispatch({ type: "hydrate", subthread: next, focus: true, remember: true });
      await setUrlState({ view: "subthreads", subthread: created.id });
      toast.success("子贴已创建，可以开始填写正文");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "创建子贴失败"));
    }
  };

  const handleDeleteSubthread = async (subthread: SubthreadDetail) => {
    const deletingCurrentDirty =
      subthread.id === state.selectedId && effectiveSubthreadStatus.dirty;
    const floorText = `${subthread._count.posts} 个楼层`;
    if (!(await confirmAction({
      title: `删除「${subthread.title}」`,
      description: `该子贴及其中 ${floorText} 将被删除，无法恢复。${deletingCurrentDirty ? "当前未保存修改也会丢失。" : ""}`,
      confirmLabel: "删除子贴",
      destructive: true,
    }))) return;
    try {
      await deleteSubthread.mutateAsync(subthread.id);
      const index = subthreads.findIndex((item) => item.id === subthread.id);
      const next = subthreads[index + 1] ?? subthreads[index - 1];
      const refreshed = await onRefetch();
      const refreshedNext = refreshed?.subthreads.find((item) => item.id === next?.id);
      if (subthread.id === state.selectedId) {
        dispatch({ type: "hydrate", subthread: refreshedNext ?? next });
        await setUrlState({
          view: "subthreads",
          subthread: (refreshedNext ?? next)?.id ?? null,
        });
      }
      toast.success("子贴已删除");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "删除子贴失败"));
    }
  };

  const handleReorder = async (ids: string[]) => {
    if (state.isReordering || ids.join() === state.orderedIds.join()) return;
    const previous = state.orderedIds;
    dispatch({ type: "order", ids, saving: true });
    try {
      await reorderSubthreads.mutateAsync({
        threadId: thread.id,
        ids: [thread.defaultSubthreadId, ...ids],
      });
      dispatch({
        type: "finish-order",
        ids,
        status: { state: "saved", dirty: false, busy: false, message: "排序已保存" },
      });
      await onRefetch();
    } catch (error) {
      const apiError = getApiError(error);
      dispatch({
        type: "finish-order",
        ids: previous,
        status: { state: "error", dirty: false, busy: false, message: "排序保存失败，已恢复原顺序" },
      });
      toast.error(
        apiError.message?.includes("默认子贴") || apiError.message?.includes("第一位")
          ? "主帖必须保持在第一位，不能与其他子帖交换顺序"
          : "排序保存失败，已恢复原顺序",
      );
    }
  };

  const handleCopyLocalContent = async () => {
    try {
      await navigator.clipboard.writeText(state.content);
      toast.success("本地正文已复制");
    } catch {
      toast.error("复制失败，请手动全选正文保存");
    }
  };

  const handleReloadSubthread = async () => {
    if (!(await confirmAction({
      title: "载入最新版本",
      description: "载入后会放弃当前子贴的本地修改。建议先复制本地正文。",
      confirmLabel: "载入最新版本",
      destructive: true,
    }))) return;
    const refreshed = await onRefetch();
    const next = refreshed?.subthreads.find((item) => item.id === state.selectedId);
    dispatch({ type: "hydrate", subthread: next });
    toast.success("已载入最新版本");
  };

  return {
    view,
    subthreads,
    selectedSub,
    selectedId: state.selectedId,
    title: state.title,
    postingPolicy: state.postingPolicy,
    content: state.content,
    resetKey: state.resetKey,
    focusRequestKey: state.focusRequestKey,
    subFormMode: state.subFormMode,
    currentStatus,
    threadStatus: state.threadStatus,
    subthreadStatus: effectiveSubthreadStatus,
    isOwner,
    isCollaborator: permissions.isCollaborator,
    isNavigationLocked,
    createPending: createSubthread.isPending,
    deletePending: deleteSubthread.isPending,
    isReordering: state.isReordering,
    setTitle: (title: string) => dispatch({ type: "title", title }),
    setPostingPolicy: (postingPolicy: PostingPolicy) =>
      dispatch({ type: "posting-policy", postingPolicy }),
    setContent: (content: string) => dispatch({ type: "content", content }),
    setSubFormMode: (mode: SubFormMode) => dispatch({ type: "form", mode }),
    setThreadStatus,
    resetSubthreadEditor: () => dispatch({ type: "reset-subthread" }),
    uploadImage: (file: File, options?: UploadImageOptions) =>
      uploadImage.mutateAsync(file, options),
    handleViewChange,
    handleExit,
    handleSelect,
    handleSaveSubthread,
    handleCreateSubthread,
    handleDeleteSubthread,
    handleReorder,
    handleCopyLocalContent,
    handleReloadSubthread,
  };
}
