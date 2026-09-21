import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FollowListPage } from "../follow-list-page";
import { setAuthSession, clearAuthSession } from "@/lib/auth-store";

const { push, profile } = vi.hoisted(() => ({ push: vi.fn(), profile: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/api/hooks/use-user-profile", () => ({ useUserProfile: () => profile() }));
vi.mock("../user-follow-list", () => ({ UserFollowList: ({ onReady }: { onReady?: () => void }) => <button onClick={onReady}>列表就绪</button> }));
beforeEach(() => {
  vi.clearAllMocks();
  setAuthSession({ id: "u1", username: "本人", email: "me@example.test", role: "USER", avatar: null }, "test");
  profile.mockReturnValue({ data: { username: "本人", _count: { following: 4, followers: 8 } }, isLoading: false });
});
afterEach(() => { cleanup(); clearAuthSession(); });
test("本人公开路径显示计数页签，并保留原深链导航", async () => {
  const person = userEvent.setup();
  render(<FollowListPage userId="u1" kind="following" />);
  expect(screen.getByRole("heading", { name: "我的关注与粉丝" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "关注 4" })).toHaveAttribute("aria-selected", "true");
  await person.click(screen.getByRole("tab", { name: "粉丝 8" }));
  expect(push).toHaveBeenCalledWith("/users/u1/followers", { scroll: false });
});
test("他人页保持浏览入口", () => {
  render(<FollowListPage userId="u2" kind="followers" />);
  expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "返回主页" })).toHaveAttribute("href", "/users/u2");
});
test("页签分别恢复滚动位置，普通刷新不重置当前滚动", async () => {
  const person = userEvent.setup();
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const y = vi.spyOn(window, "scrollY", "get").mockReturnValue(240);
  const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => { fn(0); return 1; });
  const view = render(<FollowListPage userId="u1" kind="following" />);
  await person.click(screen.getByRole("button", { name: "列表就绪" }));
  await person.click(screen.getByRole("tab", { name: "粉丝 8" }));
  view.rerender(<FollowListPage userId="u1" kind="followers" />);
  await person.click(screen.getByRole("button", { name: "列表就绪" }));
  y.mockReturnValue(480);
  await person.click(screen.getByRole("tab", { name: "关注 4" }));
  view.rerender(<FollowListPage userId="u1" kind="following" />);
  await person.click(screen.getByRole("button", { name: "列表就绪" }));
  expect(scroll).toHaveBeenLastCalledWith({ top: 240, behavior: "instant" });
  scroll.mockClear();
  await person.click(screen.getByRole("button", { name: "列表就绪" }));
  expect(scroll).not.toHaveBeenCalled();
  act(() => clearAuthSession());
  expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  frame.mockRestore(); y.mockRestore(); scroll.mockRestore();
});
