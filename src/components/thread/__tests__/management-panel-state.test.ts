import { describe, expect, it } from "vitest";
import {
  getInitialSubthread,
  getSubthreadStatus,
  managementReducer,
  type ManagementState,
} from "@/components/thread/management-panel-state";
import { SAVED_MANAGEMENT_STATUS } from "@/components/thread/management-types";

const subthread = {
  id: "sub-1",
  title: "子贴",
  postingPolicy: "PARTICIPANTS" as const,
  version: 2,
  bodyPost: { content: "正文", version: 3 },
  _count: { posts: 1 },
};

const state: ManagementState = {
  selectedId: "sub-1",
  title: "子贴",
  savedTitle: "子贴",
  postingPolicy: "PARTICIPANTS",
  savedPostingPolicy: "PARTICIPANTS",
  content: "正文",
  savedContent: "正文",
  metaVersion: 2,
  bodyVersion: 3,
  resetKey: 0,
  focusRequestKey: 0,
  subFormMode: null,
  subthreadStatus: SAVED_MANAGEMENT_STATUS,
  threadStatus: SAVED_MANAGEMENT_STATUS,
  orderedIds: ["sub-1"],
  transientSubthreads: [],
  isReordering: false,
};

describe("management panel state", () => {
  it("按请求选择子贴并在不存在时回退首项", () => {
    expect(getInitialSubthread([subthread] as never[], "sub-1")?.id).toBe("sub-1");
    expect(getInitialSubthread([subthread] as never[], "missing")?.id).toBe("sub-1");
  });

  it("派生脏状态并保留冲突消息", () => {
    expect(getSubthreadStatus(state)).toEqual(SAVED_MANAGEMENT_STATUS);
    const dirty = managementReducer(state, { type: "content", content: "本地修改" });
    expect(getSubthreadStatus(dirty)).toMatchObject({ state: "dirty", dirty: true });
    expect(getSubthreadStatus({
      ...dirty,
      subthreadStatus: { state: "conflict", dirty: true, busy: false, message: "冲突" },
    })).toMatchObject({ state: "conflict", message: "冲突" });
  });

  it("提交、重置、重排与 hydrate 都只更新对应基线", () => {
    const dirty = managementReducer(state, { type: "title", title: "新标题" });
    const committed = managementReducer(dirty, {
      type: "commit-meta",
      title: "新标题",
      postingPolicy: "COLLABORATORS",
      version: 4,
    });
    expect(committed).toMatchObject({ savedTitle: "新标题", metaVersion: 4 });
    expect(managementReducer(committed, { type: "reset-subthread" }).title).toBe("新标题");
    expect(managementReducer(state, { type: "order", ids: ["sub-2", "sub-1"], saving: true }))
      .toMatchObject({ orderedIds: ["sub-2", "sub-1"], isReordering: true });
    expect(managementReducer(state, { type: "hydrate", subthread: subthread as never, focus: true, remember: true }))
      .toMatchObject({ selectedId: "sub-1", resetKey: 1, focusRequestKey: 1 });
  });
});
