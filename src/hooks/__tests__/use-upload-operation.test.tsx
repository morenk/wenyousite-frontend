import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { useUploadOperation } from "../use-upload-operation";

afterEach(cleanup);

test("首帧重复开始只取得一个操作，结束后可重试", () => {
  const { result } = renderHook(useUploadOperation);
  let first: ReturnType<typeof result.current.start> = null;
  act(() => {
    first = result.current.start();
    expect(result.current.start()).toBeNull();
  });
  expect(result.current.pending).toBe(true);
  act(() => first!.finish());
  expect(result.current.pending).toBe(false);
  act(() => expect(result.current.start()).not.toBeNull());
});

test("取消后旧操作的进度和结束不会覆盖新操作", () => {
  const { result } = renderHook(useUploadOperation);
  let first: ReturnType<typeof result.current.start> = null;
  act(() => { first = result.current.start(); });
  act(() => { expect(result.current.cancel()).toBe(true); });
  expect(first!.signal.aborted).toBe(true);
  expect(first!.isCurrent()).toBe(false);
  act(() => { result.current.start("uploading"); first!.setPhase("saving"); first!.finish(); });
  expect(result.current.phase).toBe("uploading");
});

test("保存阶段拒绝取消，但卸载使回调失效", () => {
  const { result, unmount } = renderHook(useUploadOperation);
  let operation: ReturnType<typeof result.current.start> = null;
  act(() => { operation = result.current.start(); operation!.setPhase("saving"); });
  act(() => expect(result.current.cancel()).toBe(false));
  expect(operation!.isCurrent()).toBe(true);
  unmount();
  expect(operation!.signal.aborted).toBe(true);
  expect(operation!.isCurrent()).toBe(false);
  operation!.finish();
});
