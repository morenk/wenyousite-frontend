
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ThreadPublicationIdentity } from "../thread-publication-identity";
import type { useThreadIdentitySubmission } from "../use-thread-identity-submission";
vi.mock("@/components/thread/thread-identity-controls", () => ({ ThreadIdentityControls: () => <button>设置角色</button> }));
afterEach(cleanup);
function controller(overrides: Record<string, unknown> = {}) {
  return { query: { data: { display: { nickname: "白鸦" }, account: { username: "小明" }, canEdit: true }, refetch: vi.fn() },
    mode: "RP", choose: vi.fn(), prepare: vi.fn(), requireConfirmation: vi.fn(), canUseRp: true, displayName: "白鸦", ...overrides } as unknown as ReturnType<typeof useThreadIdentitySubmission>;
}
test("选择RP或账号并呈现当前身份，失效RP不能选，未知提交禁切换", async () => {
  const value = controller();
  const view = render(<ThreadPublicationIdentity controller={value} threadId="t1" />);
  expect(screen.getByText("以「白鸦」发表")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("combobox", { name: "发表身份" }));
  await userEvent.click(screen.getByRole("option", { name: "站内身份：小明" }));
  expect(value.choose).toHaveBeenCalledWith("ACCOUNT");
  view.rerender(<ThreadPublicationIdentity controller={controller({ canUseRp: false, mode: "ACCOUNT" })} threadId="t1" />);
  await userEvent.click(screen.getByRole("combobox", { name: "发表身份" }));
  expect(screen.getByRole("option", { name: "帖内身份：白鸦" })).toHaveAttribute("aria-disabled", "true");
  view.rerender(<ThreadPublicationIdentity controller={value} threadId="t1" disabled />);
  expect(screen.getByRole("combobox", { name: "发表身份" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "设置角色" })).not.toBeInTheDocument();
});
test("加载失败提供重试，加载状态不显示误导性的账号选择", async () => {
  const view = render(<ThreadPublicationIdentity controller={controller({ query: { isPending: true } })} threadId="t1" />);
  expect(screen.getByRole("status")).toHaveTextContent("加载");
  const refetch = vi.fn();
  view.rerender(<ThreadPublicationIdentity controller={controller({ query: { isError: true, refetch } })} threadId="t1" />);
  await userEvent.click(screen.getByRole("button", { name: "身份加载失败，重试" }));
  expect(refetch).toHaveBeenCalledOnce();
});
