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
    expect(result.current.version).toBe(1);
    expect(onChange).toHaveBeenLastCalledWith("恢复正文");
    expect(mockToastSuccess).toHaveBeenCalledWith("已恢复正文草稿");
  });

  test("重开历史正文与恢复草稿时静默把白名单外结构降为字面文本", () => {
    const onChange = vi.fn();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useEditorDraftController({ defaultValue: "# 历史标题", onChange }),
      { wrapper: Wrapper },
    );

    expect(result.current.currentContent).toBe("\\# 历史标题");
    expect(onChange).toHaveBeenCalledWith("\\# 历史标题");

    act(() => result.current.handleRestore({ content: "```\n旧代码\n```" }));
    expect(result.current.currentContent).toBe("\\`\\`\\`\n\n旧代码\n\n\\`\\`\\`");
    expect(onChange).toHaveBeenLastCalledWith("\\`\\`\\`\n\n旧代码\n\n\\`\\`\\`");
    expect(mockToastError).not.toHaveBeenCalled();
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
