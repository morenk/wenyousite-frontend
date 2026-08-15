import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";
import {
  SAVED_MANAGEMENT_STATUS,
  type ManagementEditorStatus,
} from "@/components/thread/management-types";

export type SubFormMode = { mode: "create" } | null;
export type PostingPolicy = SubthreadDetail["postingPolicy"];

export interface ManagementState {
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

export type ManagementAction =
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

export function getInitialSubthread(
  subthreads: SubthreadDetail[],
  requestedId: string | null,
) {
  return subthreads.find((subthread) => subthread.id === requestedId) ?? subthreads[0];
}

export function getSubthreadStatus(state: ManagementState): ManagementEditorStatus {
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

export function managementReducer(
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
