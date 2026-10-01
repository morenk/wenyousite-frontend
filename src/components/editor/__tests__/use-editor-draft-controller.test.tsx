import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { queryKeys } from "@/api/query-keys";
import { useEditorDraftController } from "@/components/editor/use-editor-draft-controller";
import { createQueryWrapper } from "@/test/query-client";

const { mockUseAuth, mockSaveDraft, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockSaveDraft: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/api/hooks/use-api-meta", () => ({ useApiMeta: () => ({ data: { markdownContractVersion: 5 } }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/api/hooks/use-save-draft", () => ({
  useSaveDraft: () => ({ mutateAsync: mockSaveDraft }),
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: "u1" } });
  mockSaveDraft.mockResolvedValue({ id: "d1", version: 3, content: "正文" });
});

afterEach(() => {
  vi.useRealTimers();
});

async function flushAutoSave() {
  await act(async () => {
    vi.advanceTimersByTime(800);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useEditorDraftController", () => {
  test.each(["center", "right"])("恢复 %s 对齐草稿时保留紧邻前文的合法 marker", (alignment) => {
    const content = `经历：\n[wenyousite-align-v1-${alignment}]: #\n草稿正文`;
    const onChange = vi.fn();
    const { client, Wrapper } = createQueryWrapper();
    client.setQueryData(queryKeys.meta, { markdownContractVersion: 5 });
    const { result } = renderHook(
      () => useEditorDraftController({ defaultValue: "", onChange }),
      { wrapper: Wrapper },
    );
    act(() => result.current.handleRestore({ content }));
    expect(result.current.restoredValue).toBe(content);
    expect(result.current.currentContent).toBe(content);
    expect(onChange).toHaveBeenLastCalledWith(content);
  });

  test("编辑、打开草稿与恢复快照保持外部值同步", () => {
    const onChange = vi.fn();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useEditorDraftController({ defaultValue: "初始正文", onChange }),
      { wrapper: Wrapper },
    );

    act(() => result.current.handleChange("当前正文"));
    act(() => result.current.handleOpenDrafts());
    expect(result.current.currentContent).toBe("当前正文");
    expect(result.current.draftOpen).toBe(true);

    act(() => result.current.handleChange("托盘打开后继续写"));
    expect(result.current.currentContent).toBe("托盘打开后继续写");

    act(() => result.current.handleRestore({
      content: "恢复正文",
    }));
    expect(result.current.restoredValue).toBe("恢复正文");
    expect(result.current.currentContent).toBe("恢复正文");
    expect(result.current.version).toBe(2);
    expect(onChange).toHaveBeenLastCalledWith("恢复正文");
    expect(mockToastSuccess).toHaveBeenCalledWith("已恢复正文草稿");
  });

  test("未知历史正文保留原文，恢复不支持的草稿不覆盖当前输入", () => {
    const onChange = vi.fn();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useEditorDraftController({ defaultValue: "甲 [[widget:v9:future]]", onChange }),
      { wrapper: Wrapper },
    );
    expect(result.current.currentContent).toBe("甲 [[widget:v9:future]]");
    expect(onChange).not.toHaveBeenCalled();
    act(() => result.current.handleRestore({ content: "```\n旧代码\n```" }));
    expect(result.current.currentContent).toBe("甲 [[widget:v9:future]]");
    expect(onChange).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("原草稿和当前输入已保留"));
  });

  test("已登录时窗口重新聚焦只刷新原子草稿状态", () => {
    const { client, Wrapper } = createQueryWrapper();
    const refetch = vi.spyOn(client, "refetchQueries");
    renderHook(() => useEditorDraftController({ defaultValue: "" }), { wrapper: Wrapper });

    act(() => window.dispatchEvent(new Event("focus")));

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledWith({ queryKey: queryKeys.draftState });
  });

  test("自动保存完整保留首尾内容并串接服务端版本", async () => {
    mockSaveDraft
      .mockResolvedValueOnce({ id: "d1", version: 3, content: "第一版" })
      .mockResolvedValueOnce({ id: "d1", version: 4, content: "第二版" });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useEditorDraftController({ defaultValue: "" }),
      { wrapper: Wrapper },
    );

    act(() => result.current.handleAutoSaveChange(true));
    act(() => result.current.handleChange("  第一版  "));
    await flushAutoSave();
    expect(mockSaveDraft).toHaveBeenNthCalledWith(1, { content: "  第一版  ", slot: 1 });
    expect(result.current.autoSaveStatus).toBe("saved");

    act(() => result.current.handleChange("第二版"));
    await flushAutoSave();
    expect(mockSaveDraft).toHaveBeenNthCalledWith(2, {
      draftId: "d1",
      content: "第二版",
      version: 3,
    });
  });

  test("空正文不自动保存", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useEditorDraftController({ defaultValue: "" }),
      { wrapper: Wrapper },
    );

    act(() => result.current.handleAutoSaveChange(true));
    act(() => result.current.handleChange("   "));
    await flushAutoSave();

    expect(mockSaveDraft).not.toHaveBeenCalled();
    expect(result.current.autoSaveStatus).toBe("idle");
  });

  test("自动保存失败后关闭开关并提示错误", async () => {
    mockSaveDraft.mockRejectedValueOnce(new Error("network"));
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useEditorDraftController({ defaultValue: "" }),
      { wrapper: Wrapper },
    );

    act(() => result.current.handleAutoSaveChange(true));
    act(() => result.current.handleChange("失败正文"));
    await flushAutoSave();
    await act(async () => Promise.resolve());

    expect(result.current.autoSaveStatus).toBe("error");
    expect(result.current.autoSaveEnabled).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("network"));
  });
});


test("编码失效取消待发送的旧草稿，恢复后只保存当前有效正文", async () => {
  const { Wrapper } = createQueryWrapper();
  const flush = vi.fn<() => string | null>().mockReturnValue("A");
  const { result } = renderHook(() => useEditorDraftController({ defaultValue: "A", flush }), { wrapper: Wrapper });
  act(() => result.current.handleAutoSaveChange(true));
  act(() => result.current.handleValidityChange(false));
  flush.mockReturnValue(null);
  await flushAutoSave();
  expect(mockSaveDraft).not.toHaveBeenCalled();
  expect(result.current.autoSaveStatus).toBe("error");
  act(() => { result.current.handleValidityChange(true); result.current.handleChange("AB"); });
  flush.mockReturnValue("AB");
  await flushAutoSave();
  expect(mockSaveDraft).toHaveBeenCalledExactlyOnceWith({ content: "AB", slot: 1 });
});

test("自动草稿队列等待期间失效，尚未发送的旧值不会覆盖最后有效草稿", async () => {
  const { Wrapper } = createQueryWrapper();
  let resolveSave!: (value: { id: string; version: number }) => void;
  mockSaveDraft.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
  const { result } = renderHook(() => useEditorDraftController({ defaultValue: "A" }), { wrapper: Wrapper });
  act(() => result.current.handleAutoSaveChange(true));
  await flushAutoSave();
  act(() => result.current.handleChange("AB"));
  await flushAutoSave();
  act(() => result.current.handleValidityChange(false));
  await act(async () => { resolveSave({ id: "d1", version: 2 }); });
  expect(mockSaveDraft).toHaveBeenCalledTimes(1);
  expect(result.current.currentContent).toBe("AB");
  expect(result.current.autoSaveStatus).toBe("error");
});

test("同步失败取消待发送自动草稿，恢复后保存最新正文", async () => {
  const onSyncErrorChange = vi.fn();
  const { result } = renderHook(() => useEditorDraftController({ defaultValue: "初始正文", onSyncErrorChange }), { wrapper: createQueryWrapper().Wrapper });
  act(() => { result.current.handleAutoSaveChange(true); result.current.handleChange("已同步修改"); });
  act(() => result.current.handleSyncError(true));
  await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  expect(mockSaveDraft).not.toHaveBeenCalled();
  expect(result.current.syncError).toBe(true);
  expect(onSyncErrorChange).toHaveBeenLastCalledWith(true);
  act(() => { result.current.handleChange("恢复后的最新正文"); result.current.handleSyncError(false); });
  await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  expect(mockSaveDraft).toHaveBeenCalledWith(expect.objectContaining({ content: "恢复后的最新正文" }));
});


test("即时变更使旧快照失效，800ms从实际编辑而非延后快照计时", async () => {
  const flush = vi.fn(() => "最终正文");
  const { result } = renderHook(() => useEditorDraftController({ defaultValue: "旧正文", flush }), { wrapper: createQueryWrapper().Wrapper });
  act(() => result.current.handleAutoSaveChange(true));
  await act(async () => vi.advanceTimersByTimeAsync(700));
  act(() => result.current.handleDocumentChange());
  await act(async () => vi.advanceTimersByTimeAsync(120));
  act(() => result.current.handleChange("最终正文"));
  await act(async () => vi.advanceTimersByTimeAsync(679));
  expect(mockSaveDraft).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(mockSaveDraft).toHaveBeenCalledExactlyOnceWith({ content: "最终正文", slot: 1 });
});

test("组词期间取消队列，结束后保存最终快照且恢复草稿被保护", async () => {
  const { result } = renderHook(() => useEditorDraftController({ defaultValue: "正文" }), { wrapper: createQueryWrapper().Wrapper });
  act(() => { result.current.handleAutoSaveChange(true); result.current.handleCompositionChange(true); result.current.handleDocumentChange(); });
  await flushAutoSave();
  act(() => result.current.handleRestore({ content: "覆盖" }));
  expect(result.current.currentContent).toBe("正文");
  expect(mockSaveDraft).not.toHaveBeenCalled();
  expect(result.current.syncError).toBe(false);
  act(() => { result.current.handleDocumentChange(); result.current.handleChange("最终词语"); result.current.handleCompositionChange(false); });
  await flushAutoSave();
  expect(mockSaveDraft).toHaveBeenCalledExactlyOnceWith({ content: "最终词语", slot: 1 });
});

test("同目标恢复使旧正文队列失效，已发响应只推进版本", async () => {
  let resolveSave!: (value: { id: string; version: number }) => void;
  mockSaveDraft.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
  const { result } = renderHook(() => useEditorDraftController({ defaultValue: "A" }), { wrapper: createQueryWrapper().Wrapper });
  act(() => result.current.handleAutoSaveChange(true, { id: "d1", version: 1 }));
  await flushAutoSave();
  act(() => result.current.handleChange("旧队列"));
  await flushAutoSave();
  act(() => result.current.handleRestore({ content: "恢复后的正文" }));
  await act(async () => resolveSave({ id: "d1", version: 2 }));
  expect(mockSaveDraft).toHaveBeenCalledTimes(1);
  expect(result.current.currentContent).toBe("恢复后的正文");
  expect(result.current.autoSaveStatus).not.toBe("saved");
  await flushAutoSave();
  expect(mockSaveDraft).toHaveBeenLastCalledWith({ draftId: "d1", content: "恢复后的正文", version: 2 });
});

test.each(["toggle", "account"])("%s建立新保存会话，旧成功响应不能改变新目标", async (kind) => {
  let resolveSave!: (value: { id: string; version: number }) => void;
  mockSaveDraft.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
  const { result, rerender } = renderHook(() => useEditorDraftController({ defaultValue: "A" }), { wrapper: createQueryWrapper().Wrapper });
  act(() => result.current.handleAutoSaveChange(true, { id: "old", version: 1 }));
  await flushAutoSave();
  if (kind === "account") {
    mockUseAuth.mockReturnValue({ user: { id: "u2" } });
    rerender();
    expect(result.current.autoSaveEnabled).toBe(false);
  } else act(() => result.current.handleAutoSaveChange(false));
  act(() => result.current.handleAutoSaveChange(true, { id: "new", version: 8 }));
  await act(async () => resolveSave({ id: "old", version: 2 }));
  await flushAutoSave();
  expect(mockSaveDraft).toHaveBeenLastCalledWith({ draftId: "new", content: "A", version: 8 });
});

test("自动保存已启用时手动更新槽位版本仍重新排程", async () => {
  const { result } = renderHook(() => useEditorDraftController({ defaultValue: "A" }), { wrapper: createQueryWrapper().Wrapper });
  act(() => result.current.handleAutoSaveChange(true, { id: "d1", version: 1 }));
  await act(async () => vi.advanceTimersByTimeAsync(400));
  act(() => result.current.handleAutoSaveChange(true, { id: "d1", version: 3 }));
  await flushAutoSave();
  expect(mockSaveDraft).toHaveBeenCalledExactlyOnceWith({ draftId: "d1", content: "A", version: 3 });
});

test("卸载后取消尚未发送的保存", async () => {
  const { result, unmount } = renderHook(() => useEditorDraftController({ defaultValue: "A" }), { wrapper: createQueryWrapper().Wrapper });
  act(() => result.current.handleAutoSaveChange(true));
  unmount();
  await flushAutoSave();
  expect(mockSaveDraft).not.toHaveBeenCalled();
});


test("组词中切账号取消旧队列并清除组合状态，新账号编辑可重新开启保存", async () => {
  const { result, rerender } = renderHook(() => useEditorDraftController({ defaultValue: "旧正文" }), { wrapper: createQueryWrapper().Wrapper });
  act(() => { result.current.handleAutoSaveChange(true); result.current.handleCompositionChange(true); result.current.handleDocumentChange(); });
  mockUseAuth.mockReturnValue({ user: { id: "u2" } });
  rerender();
  await flushAutoSave();
  expect(mockSaveDraft).not.toHaveBeenCalled();
  expect(result.current.autoSaveEnabled).toBe(false);
  act(() => { result.current.handleDocumentChange(); result.current.handleChange("新账号正文"); result.current.handleAutoSaveChange(true, { id: "new", version: 1 }); });
  await flushAutoSave();
  expect(mockSaveDraft).toHaveBeenCalledExactlyOnceWith({ draftId: "new", content: "新账号正文", version: 1 });
});
