import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RpIdentityProfile } from "../rp-identity-profile";
import { role } from "./rp-identity-fixtures";
const mocks = vi.hoisted(() => ({ meta: vi.fn(), post: vi.fn(), retry: vi.fn() }));
vi.mock("@/api/hooks/use-api-meta", () => ({ useApiMeta: () => mocks.meta() }));
vi.mock("@/api/hooks/use-rp-profile-post", async (original) => ({ ...await original<typeof import("@/api/hooks/use-rp-profile-post")>(), useRpProfilePost: (...args: unknown[]) => mocks.post(...args) }));
const data = { id: "p1", content: "当前原文", parentPostId: "parent1", parentPost: { floorNumber: 3 }, replyNumber: 2, kind: "FLOOR", subthread: { title: "角色报名" } };
const props = { threadId: "t1", identityId: "rp1", state: role("rp1", "白鸦", { profilePostStatus: "AVAILABLE", profilePostId: "p1" }),
  renderBody: (post: { content: string }) => <article>{post.content}</article>, onNavigate: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); mocks.meta.mockReturnValue({ data: { capabilities: { rpIdentityProfileSupported: true } } }); mocks.post.mockReturnValue({ data, refetch: mocks.retry }); });
afterEach(cleanup);
test("只展示原正文和来源坐标，坐标可进入准确楼中楼", () => {
  render(<RpIdentityProfile {...props} />);
  expect(screen.getByRole("article")).toHaveTextContent("当前原文");
  const link = screen.getByRole("link", { name: "角色报名 · 3楼 · 2回复" });
  expect(link).toHaveAttribute("href", "/threads/t1/posts/parent1/replies?post=p1");
  fireEvent.click(link); expect(props.onNavigate).toHaveBeenCalledOnce();
});
test("身份重新授权未完成、旧能力、未绑定不渲染缓存正文或空块", () => {
  const view = render(<RpIdentityProfile {...props} identityPending />);
  expect(screen.queryByText("当前原文")).not.toBeInTheDocument();
  expect(mocks.post).toHaveBeenLastCalledWith("t1", "rp1", undefined, true);
  view.rerender(<RpIdentityProfile {...props} state={role("rp1", "白鸦", { profilePostStatus: "NONE", profilePostId: null })} />);
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  mocks.meta.mockReturnValue({ data: { capabilities: {} } });
  view.rerender(<RpIdentityProfile {...props} />);
  expect(screen.queryByText("当前原文")).not.toBeInTheDocument();
});
test("不可读统一不可用，网络失败局部重试，刷新不展示旧内容", () => {
  const view = render(<RpIdentityProfile {...props} state={role("rp1", "白鸦", { profilePostStatus: "UNAVAILABLE", profilePostId: null })} />);
  expect(screen.getByText("资料暂不可用")).toBeInTheDocument();
  expect(screen.queryByText("当前原文")).not.toBeInTheDocument();
  mocks.post.mockReturnValue({ isError: true, error: new Error("offline"), refetch: mocks.retry });
  view.rerender(<RpIdentityProfile {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "重试" })); expect(mocks.retry).toHaveBeenCalledOnce();
  mocks.post.mockReturnValue({ isFetching: true });
  view.rerender(<RpIdentityProfile {...props} />);
  expect(screen.getByRole("status")).toHaveTextContent("正在加载资料");
  mocks.post.mockReturnValue({ isError: true, error: { status: 404, code: 40403 } });
  view.rerender(<RpIdentityProfile {...props} />);
  expect(screen.getByText("资料暂不可用")).toBeInTheDocument();
});
