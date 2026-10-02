import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiscussionJump } from "../discussion-jump";
afterEach(cleanup);

describe("精简编号定位", () => {
  test("仅保留编号表单，打开不自动聚焦输入，可用 Enter 跳转", async () => {
    const user = userEvent.setup();
    const onJump = vi.fn().mockResolvedValue(undefined);
    render(<DiscussionJump subject="回复" current={128} maxNumber={3286} total={3285} onJump={onJump} />);
    await user.click(screen.getByRole("button", { name: "跳转到回复" }));
    expect(screen.getByText("当前 #128 · 编号至 #3286")).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "回复编号" });
    expect(input).not.toHaveFocus();
    expect(screen.queryByRole("button", { name: /最早|中间|最新/ })).not.toBeInTheDocument();
    await user.type(input, "2800{Enter}");
    await waitFor(() => expect(onJump).toHaveBeenCalledWith(2800, expect.any(AbortSignal)));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  test.each(["0", "-1", "1.5", "abc", "9007199254740993", "4000"])("非法编号 %s 内联错误且不请求", async (number) => {
    const user = userEvent.setup(); const onJump = vi.fn();
    render(<DiscussionJump subject="楼层" maxNumber={3286} total={3000} compact onJump={onJump} />);
    await user.click(screen.getByRole("button", { name: "跳转到楼层" }));
    await user.type(screen.getByRole("textbox"), number);
    await user.click(screen.getByRole("button", { name: "前往" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onJump).not.toHaveBeenCalled();
  });
  test("请求失败保留输入与表单，关闭后重新打开清理错误", async () => {
    const user = userEvent.setup(); const onJump = vi.fn().mockRejectedValue(new Error("network"));
    render(<DiscussionJump subject="楼层" maxNumber={20} total={20} current={3} compact onJump={onJump} />);
    expect(screen.getByText("#3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "跳转到楼层" }));
    await user.type(screen.getByRole("textbox"), "18{Enter}");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("18");
    await user.click(screen.getByRole("button", { name: "关闭" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "跳转到楼层" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });
  test("空讨论入口禁用", () => {
    render(<DiscussionJump subject="回复" maxNumber={0} total={0} onJump={vi.fn()} />);
    expect(screen.getByRole("button", { name: "跳转到回复" })).toBeDisabled();
  });
  test("取消后重开，旧响应不能关闭或污染新面板", async () => {
    const user = userEvent.setup(); let finish!: () => void;
    const onJump = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<DiscussionJump subject="回复" maxNumber={3000} total={3000} onJump={onJump} />);
    await user.click(screen.getByRole("button", { name: "跳转到回复" }));
    await user.type(screen.getByRole("textbox"), "2000{Enter}");
    await waitFor(() => expect(onJump).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(onJump.mock.calls[0][1].aborted).toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "跳转到回复" }));
    await user.type(screen.getByRole("textbox"), "128");
    await act(async () => finish());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("128");
  });

  test("打开面板时立即通知控制器取消旧定位", async () => {
    const user = userEvent.setup(); const onOpen = vi.fn();
    render(<DiscussionJump subject="回复" maxNumber={3000} total={3000} onJump={vi.fn()} onOpen={onOpen} />);
    await user.click(screen.getByRole("button", { name: "跳转到回复" }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

});
