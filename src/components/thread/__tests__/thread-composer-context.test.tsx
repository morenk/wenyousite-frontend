/** ThreadComposerProvider 测试：保证详情页仅有一个受保护的编辑会话 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ThreadComposerProvider,
  useThreadComposer,
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
