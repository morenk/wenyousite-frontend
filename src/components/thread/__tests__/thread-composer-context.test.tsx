/** ThreadComposerProvider 测试：保证详情页仅有一个受保护的编辑会话 */

import { useEffect } from "react";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ThreadComposerProvider,
  useThreadComposer,
  useThreadComposerSession,
  type ThreadComposerSession,
} from "@/components/thread/thread-composer-context";

const createFloorSession: ThreadComposerSession = {
  key: "create-floor:s1",
  anchorId: "create-floor:s1",
  type: "create-floor",
  subthreadId: "s1",
  label: "发表回复",
  initialContent: "",
};

const replySession: ThreadComposerSession = {
  key: "reply:post-1",
  anchorId: "reply:post-1",
  type: "reply",
  subthreadId: "s1",
  parentPostId: "post-1",
  replyToPostId: "post-1",
  label: "回复 #1 小明",
  initialContent: "",
};

function Harness() {
  const composer = useThreadComposer();

  return (
    <div>
      <span data-testid="session">{composer.session?.key ?? "closed"}</span>
      <span data-testid="content">{composer.content}</span>
      <button onClick={() => composer.open(createFloorSession)}>发新楼层</button>
      <button onClick={() => composer.open(replySession)}>回复楼层</button>
      <button onClick={() => composer.setContent("未提交内容")}>输入内容</button>
      <button onClick={() => composer.setPending(true)}>开始提交</button>
      <button onClick={() => composer.close()}>取消</button>
      <button onClick={() => composer.close({ force: true })}>强制关闭</button>
    </div>
  );
}

describe("ThreadComposerProvider", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  test("打开新目标时全局只保留一个会话并重置内容", async () => {
    const user = userEvent.setup();
    render(<ThreadComposerProvider><Harness /></ThreadComposerProvider>);

    await user.click(screen.getByRole("button", { name: "发新楼层" }));
    await user.click(screen.getByRole("button", { name: "输入内容" }));
    await user.click(screen.getByRole("button", { name: "回复楼层" }));

    expect(screen.getByTestId("session")).toHaveTextContent("reply:post-1");
    expect(screen.getByTestId("content")).toHaveTextContent("");
  });

  test("存在未提交内容时拒绝未经确认的目标切换和关闭", async () => {
    const user = userEvent.setup();
    vi.mocked(confirm).mockReturnValue(false);
    render(<ThreadComposerProvider><Harness /></ThreadComposerProvider>);

    await user.click(screen.getByRole("button", { name: "发新楼层" }));
    await user.click(screen.getByRole("button", { name: "输入内容" }));
    await user.click(screen.getByRole("button", { name: "回复楼层" }));
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("session")).toHaveTextContent("create-floor:s1");
    expect(screen.getByTestId("content")).toHaveTextContent("未提交内容");
  });

  test("提交期间禁止切换和普通关闭，提交成功可强制关闭", async () => {
    const user = userEvent.setup();
    render(<ThreadComposerProvider><Harness /></ThreadComposerProvider>);

    await user.click(screen.getByRole("button", { name: "发新楼层" }));
    await user.click(screen.getByRole("button", { name: "开始提交" }));
    await user.click(screen.getByRole("button", { name: "回复楼层" }));
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.getByTestId("session")).toHaveTextContent("create-floor:s1");
    expect(confirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "强制关闭" }));
    expect(screen.getByTestId("session")).toHaveTextContent("closed");
  });
});


test("关闭guard同步最新正文后才判断dirty，不依赖上一轮render", async () => {
  vi.stubGlobal("confirm", vi.fn(() => false));
  const { result } = renderHook(useThreadComposer, { wrapper: ThreadComposerProvider });
  await act(async () => { await result.current.open(createFloorSession); });
  act(() => result.current.registerCloseGuard(() => { result.current.setContent("最后一字"); return true; }));
  await act(async () => { expect(await result.current.close()).toBe(false); });
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(result.current.session?.key).toBe(createFloorSession.key);
});

test("确认期间的新输入保留现场，撤销原文同步后不再误报dirty", async () => {
  let accept!: (value: boolean) => void;
  vi.stubGlobal("confirm", vi.fn(() => new Promise<boolean>((resolve) => { accept = resolve; })));
  const { result } = renderHook(useThreadComposer, { wrapper: ThreadComposerProvider });
  await act(async () => { await result.current.open(createFloorSession); });
  act(() => { result.current.onDocumentChange(); result.current.setContent("A"); });
  let closing!: Promise<boolean>;
  act(() => { closing = result.current.close(); });
  act(() => { result.current.onDocumentChange(); result.current.setContent("AB"); });
  await act(async () => { accept(true); expect(await closing).toBe(false); });
  expect(result.current.content).toBe("AB");
  act(() => { result.current.onDocumentChange(); result.current.setContent(""); });
  expect(result.current.dirty).toBe(false);
  vi.mocked(confirm).mockClear();
  await act(async () => { expect(await result.current.close()).toBe(true); });
  expect(confirm).not.toHaveBeenCalled();
});

test("仅订阅会话的楼层入口不随正文快照重渲染", async () => {
  let composer!: ReturnType<typeof useThreadComposer>;
  const renderSession = vi.fn();
  function Writer() {
    const value = useThreadComposer();
    useEffect(() => { composer = value; }, [value]);
    return null;
  }
  function Entry() { renderSession(useThreadComposerSession().session); return null; }
  render(<ThreadComposerProvider><Writer /><Entry /></ThreadComposerProvider>);
  await act(async () => { await composer.open(createFloorSession); });
  renderSession.mockClear();
  act(() => { composer.onDocumentChange(); composer.setContent("A"); });
  act(() => { composer.onDocumentChange(); composer.setContent("AB"); });
  expect(renderSession).not.toHaveBeenCalled();
});
