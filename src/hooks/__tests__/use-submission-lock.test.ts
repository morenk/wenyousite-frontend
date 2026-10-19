import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSubmissionLock } from "@/hooks/use-submission-lock";

describe("useSubmissionLock", () => {
  it("首帧同步阻止重复写入，未完成时保持 pending，完成后可再次提交", async () => {
    const { result } = renderHook(useSubmissionLock);
    let finish!: () => void;
    const action = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    let first!: Promise<void>;
    act(() => { const submit = result.current.guard(action); first = submit(); void submit(); });
    expect(action).toHaveBeenCalledOnce();
    expect(result.current.pending).toBe(true);
    await act(async () => { finish(); await first; });
    expect(result.current.pending).toBe(false);
    action.mockResolvedValue(undefined);
    await act(async () => { await result.current.guard(action)(); });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("错误继续交给业务处理且 finally 解锁，不影响其他表单实例", async () => {
    const { result } = renderHook(() => ({ first: useSubmissionLock(), second: useSubmissionLock() }));
    const error = new Error("保存失败");
    await act(async () => { await expect(result.current.first.guard(async () => { throw error; })()).rejects.toBe(error); });
    expect(result.current.first.pending).toBe(false);
    const action = vi.fn(async () => {});
    await act(async () => { await Promise.all([result.current.first.guard(action)(), result.current.second.guard(action)()]); });
    expect(action).toHaveBeenCalledTimes(2);
  });
});
