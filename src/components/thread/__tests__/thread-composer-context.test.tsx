/** ThreadComposerProvider 测试：保证详情页仅有一个受保护的编辑会话 */

import { useEffect, useState } from "react";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ThreadComposerProvider,
  ThreadReplyDraftsProvider,
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

const editSession: ThreadComposerSession = { ...createFloorSession, key: "edit:post-2", type: "edit", postId: "post-2", version: 1 };

function Harness() {
  const composer = useThreadComposer();

  return (
    <div>
      <span data-testid="session">{composer.session?.key ?? "closed"}</span>
      <span data-testid="content">{composer.content}</span>
      <button onClick={() => composer.open(createFloorSession)}>发新楼层</button>
      <button onClick={() => composer.open(replySession)}>回复楼层</button>
      <button onClick={() => composer.open(editSession)}>编辑楼层</button>
      <button onClick={() => composer.setContent("未提交内容")}>输入内容</button>
      <button onClick={() => composer.setPending(true)}>开始提交</button>
      <button onClick={() => composer.close()}>取消</button>
      <button onClick={() => composer.close({ force: true })}>强制关闭</button>
    </div>
  );
}

afterEach(() => cleanup());

describe("ThreadComposerProvider", () => {

  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  test("打开新回复目标时全局只保留一个会话并继续原正文", async () => {
    const user = userEvent.setup();
    render(<ThreadComposerProvider><Harness /></ThreadComposerProvider>);

    await user.click(screen.getByRole("button", { name: "发新楼层" }));
    await user.click(screen.getByRole("button", { name: "输入内容" }));
    await user.click(screen.getByRole("button", { name: "回复楼层" }));

    expect(screen.getByTestId("session")).toHaveTextContent("reply:post-1");
    expect(screen.getByTestId("content")).toHaveTextContent("未提交内容");
    expect(confirm).not.toHaveBeenCalled();
  });

  test("编辑已发布内容时仍拒绝未经确认的目标切换和关闭", async () => {
    const user = userEvent.setup();
    vi.mocked(confirm).mockReturnValue(false);
    render(<ThreadComposerProvider><Harness /></ThreadComposerProvider>);

    await user.click(screen.getByRole("button", { name: "编辑楼层" }));
    await user.click(screen.getByRole("button", { name: "输入内容" }));
    await user.click(screen.getByRole("button", { name: "回复楼层" }));
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("session")).toHaveTextContent("edit:post-2");
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
  await act(async () => { await result.current.open(editSession); });
  act(() => result.current.registerCloseGuard(() => { result.current.setContent("最后一字"); return true; }));
  await act(async () => { expect(await result.current.close()).toBe(false); });
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(result.current.session?.key).toBe(editSession.key);
});

test("确认期间的新输入保留现场，撤销原文同步后不再误报dirty", async () => {
  let accept!: (value: boolean) => void;
  vi.stubGlobal("confirm", vi.fn(() => new Promise<boolean>((resolve) => { accept = resolve; })));
  const { result } = renderHook(useThreadComposer, { wrapper: ThreadComposerProvider });
  await act(async () => { await result.current.open(editSession); });
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


test("收起和切换目标先同步最后输入，保留身份和媒体但不用旧回复目标", async () => {
  vi.stubGlobal("confirm", vi.fn(() => false));
  const { result } = renderHook(useThreadComposer, { wrapper: ThreadComposerProvider });
  const source = { ...replySession, mediaAudios: [{ sourceUrl: "https://bucket.example/a.mp3", mediaId: "a", contentType: "audio/mpeg" as const, size: 100, durationMs: 1000 }], mediaDisplays: [{ sourceUrl: "https://example.com/source.png", display: null }] };
  await act(async () => { await result.current.open(source); });
  act(() => {
    result.current.setIdentitySelection({ scope: source.key, mode: "RP", identityId: "role-1", token: "token", name: "角色" });
    result.current.registerCloseGuard(() => { result.current.setContent("**最后一字** ![图](https://example.com/source.png)"); return true; });
  });
  await act(async () => { expect(await result.current.close()).toBe(true); });
  await act(async () => { await result.current.open(createFloorSession); });
  expect(result.current.content).toBe("**最后一字** ![图](https://example.com/source.png)");
  expect(result.current.session).toMatchObject({ type: "create-floor", mediaDisplays: source.mediaDisplays, mediaAudios: source.mediaAudios });
  expect(result.current.session).not.toHaveProperty("parentPostId");
  expect(result.current.identitySelection).toMatchObject({ scope: createFloorSession.key, identityId: "role-1" });
  expect(confirm).not.toHaveBeenCalled();
});

test.each(["guard", "invalid", "unsynchronized"])("%s 保护未完成编辑，不切换或收起", async (reason) => {
  const { result } = renderHook(useThreadComposer, { wrapper: ThreadComposerProvider });
  await act(async () => { await result.current.open(createFloorSession); });
  act(() => {
    result.current.setContent("保留现场");
    if (reason === "guard") result.current.registerCloseGuard(() => false);
    if (reason === "invalid") result.current.setEditorValid(false);
    if (reason === "unsynchronized") result.current.onDocumentChange();
  });
  await act(async () => {
    expect(await result.current.open(replySession)).toBe(false);
    expect(await result.current.close()).toBe(false);
  });
  expect(result.current.content).toBe("保留现场");
});

test("跨回复路由重挂恢复同主题草稿，不同主题隔离，切换账号与登出销毁草稿", async () => {
  let composer!: ReturnType<typeof useThreadComposer>;
  function Capture() { const value = useThreadComposer(); useEffect(() => { composer = value; }, [value]); return null; }
  const view = (accountId: string, threadId: string, route: string) => (
    <ThreadReplyDraftsProvider accountId={accountId}>
      <ThreadComposerProvider key={route} threadId={threadId}><Capture /></ThreadComposerProvider>
    </ThreadReplyDraftsProvider>
  );
  const { rerender } = render(view("u1", "t1", "floor"));
  await act(async () => { await composer.open(createFloorSession); });
  act(() => { composer.setContent("主题一草稿"); });
  rerender(view("u1", "t1", "replies"));
  await act(async () => { await composer.open(replySession); });
  expect(composer.content).toBe("主题一草稿");
  rerender(view("u1", "t2", "replies"));
  await act(async () => { await composer.open(replySession); });
  expect(composer.content).toBe("");
  act(() => { composer.setContent("主题二草稿"); });
  rerender(view("u1", "t1", "floor"));
  await act(async () => { await composer.open(createFloorSession); });
  expect(composer.content).toBe("主题一草稿");
  for (const account of ["u2", "u1", "anonymous", "u1"]) {
    rerender(view(account, "t1", "floor"));
    await act(async () => { await composer.open(createFloorSession); });
    expect(composer.content).toBe("");
    act(() => { composer.setContent("这个账号的新草稿"); });
  }
});

test("编辑原帖与回复稿隔离，保存编辑不清除回复稿，访问失效强制关闭清除所有临时内容", async () => {
  const { result } = renderHook(useThreadComposer, { wrapper: ThreadComposerProvider });
  await act(async () => { await result.current.open(replySession); });
  act(() => { result.current.setContent("未发表回复"); });
  await act(async () => { await result.current.open({ ...editSession, initialContent: "已发原文" }); });
  expect(result.current.content).toBe("已发原文");
  act(() => { result.current.setContent("修改原文"); });
  await act(async () => { await result.current.close({ force: true, preserveReplyDraft: true }); await result.current.open(replySession); });
  expect(result.current.content).toBe("未发表回复");
  await act(async () => { await result.current.close({ force: true }); await result.current.open(replySession); });
  expect(result.current.content).toBe("");
});

test("跨路由仍锁定未确认请求的原目标和UUID，原入口可恢复重试", async () => {
  let composer!: ReturnType<typeof useThreadComposer>;
  function Capture() { const value = useThreadComposer(); useEffect(() => { composer = value; }, [value]); return null; }
  const view = (route: string) => <ThreadReplyDraftsProvider accountId="u1"><ThreadComposerProvider key={route} threadId="t1"><Capture /></ThreadComposerProvider></ThreadReplyDraftsProvider>;
  const { rerender } = render(view("a"));
  await act(async () => { await composer.open(replySession); });
  const request = { subthreadId: "s1", parentPostId: "post-1", replyToPostId: "post-1", content: "原请求正文", clientRequestId: "uuid-1" };
  act(() => { composer.setContent(request.content); composer.setPendingCreate(request); });
  rerender(view("b"));
  await act(async () => { expect(await composer.open(createFloorSession)).toBe(false); });
  await act(async () => { expect(await composer.open(replySession)).toBe(true); });
  expect(composer.pendingCreate).toEqual(request);
  expect(composer.content).toBe(request.content);
  await act(async () => { expect(await composer.close()).toBe(false); });
});


test("已卸载 Provider 的迟到同步或请求结束不能覆盖或删除新页面草稿", async () => {
  let composer!: ReturnType<typeof useThreadComposer>;
  function Capture() { const value = useThreadComposer(); useEffect(() => { composer = value; }, [value]); return null; }
  const view = (route: string) => <ThreadReplyDraftsProvider accountId="u1"><ThreadComposerProvider key={route} threadId="t1"><Capture /></ThreadComposerProvider></ThreadReplyDraftsProvider>;
  const { rerender } = render(view("a"));
  await act(async () => { await composer.open(createFloorSession); });
  const oldComposer = composer;
  rerender(view("b"));
  await act(async () => { await composer.open(replySession); });
  act(() => { composer.setContent("新页面继续写的正文"); oldComposer.setSessionContent(createFloorSession.key, "旧页迟到快照"); oldComposer.setContent("旧页异步回调"); });
  await act(async () => { expect(await oldComposer.close({ force: true })).toBe(false); });
  rerender(view("c"));
  await act(async () => { await composer.open(createFloorSession); });
  expect(composer.content).toBe("新页面继续写的正文");
});


test("离开主题页后未确认请求仍有刷新保护，登出销毁后解除", async () => {
  let composer!: ReturnType<typeof useThreadComposer>;
  function Capture() { const value = useThreadComposer(); useEffect(() => { composer = value; }, [value]); return null; }
  const view = (account: string, inside: boolean) => <ThreadReplyDraftsProvider accountId={account}>{inside ? <ThreadComposerProvider threadId="t1"><Capture /></ThreadComposerProvider> : <span>其他页面</span>}</ThreadReplyDraftsProvider>;
  const { rerender } = render(view("u1", true));
  await act(async () => { await composer.open(replySession); });
  act(() => { composer.setPendingCreate({ subthreadId: "s1", content: "待确认", clientRequestId: "uuid" }); });
  rerender(view("u1", false));
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  rerender(view("anonymous", false));
  const logoutUnload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(logoutUnload);
  expect(logoutUnload.defaultPrevented).toBe(false);
});


test("认证初始化或账号改变只重置草稿，不重挂普通页面交互状态", async () => {
  function Page() {
    const [tab, setTab] = useState("发现");
    return <button onClick={() => setTab("关注")}>{tab}</button>;
  }
  const view = (accountId: string) => <ThreadReplyDraftsProvider accountId={accountId}><Page /></ThreadReplyDraftsProvider>;
  const { rerender } = render(view("anonymous"));
  await userEvent.click(screen.getByRole("button", { name: "发现" }));
  rerender(view("u1"));
  expect(screen.getByRole("button", { name: "关注" })).toBeInTheDocument();
  rerender(view("u2"));
  expect(screen.getByRole("button", { name: "关注" })).toBeInTheDocument();
});


test("新媒体快照随回复目标切换保存，旧目标的媒体回调不能改写新草稿", async () => {
  const { result } = renderHook(useThreadComposer, { wrapper: ThreadComposerProvider });
  const media = [{ sourceUrl: "https://example.com/new.gif", display: null }];
  await act(async () => { await result.current.open(createFloorSession); });
  act(() => { result.current.setSessionMediaDisplays(createFloorSession.key, media); result.current.setContent("![新图](https://example.com/new.gif)"); });
  await act(async () => { await result.current.open(replySession); });
  expect(result.current.session?.mediaDisplays).toEqual(media);
  act(() => { result.current.setSessionMediaDisplays(createFloorSession.key, []); });
  expect(result.current.session?.mediaDisplays).toEqual(media);
});


test("迟到的外部关闭只能处理原会话，不能关闭新回复目标", async () => {
  const { result } = renderHook(useThreadComposer, { wrapper: ThreadComposerProvider });
  await act(async () => { await result.current.open(createFloorSession); });
  act(() => { result.current.setContent("保留正文"); });
  await act(async () => { await result.current.open(replySession); });
  await act(async () => { expect(await result.current.close({ sessionKey: createFloorSession.key })).toBe(false); });
  expect(result.current.session?.key).toBe(replySession.key);
  expect(result.current.content).toBe("保留正文");
  await act(async () => { expect(await result.current.close({ sessionKey: replySession.key })).toBe(true); });
  expect(result.current.session).toBeNull();
});
