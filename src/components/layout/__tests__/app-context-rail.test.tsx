import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AppContextRail } from "@/components/layout/app-context-rail";
import { UnreadCountsProvider } from "@/components/layout/unread-counts-context";

const { mockUseAuth, mockUsePathname } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUsePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => mockUsePathname() }));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/api/hooks/use-economy", () => ({
  useWallet: () => ({ data: { balance: "18" } }),
}));

describe("AppContextRail", () => {
  beforeEach(() => { vi.clearAllMocks(); mockUsePathname.mockReturnValue("/"); });
  afterEach(() => cleanup());

  test("登录后集中展示个人高频入口及未读数", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "用户", avatar: null },
    });

    render(
      <UnreadCountsProvider notificationCount={3} directMessageCount={2}>
        <AppContextRail />
      </UnreadCountsProvider>,
    );

    expect(screen.getByRole("link", { name: /用户/ })).toHaveAttribute("href", "/users/u1");
    expect(screen.getByRole("link", { name: "通知，3 条未读" })).toHaveAttribute(
      "href",
      "/notifications",
    );
    expect(screen.getByRole("link", { name: "私聊，2 条未读" })).toHaveAttribute(
      "href",
      "/messages",
    );
    expect(screen.getByRole("link", { name: "收藏" })).toHaveAttribute("href", "/bookmarks");
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute("href", "/me");
    expect(screen.getByText("18 升")).toBeInTheDocument();
    expect(screen.queryByText("按玩法发现")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "玩法分类" })).not.toBeInTheDocument();
  });


  test.each([
    ["/notifications", "通知"], ["/messages/c1", "私聊"], ["/bookmarks", "收藏"], ["/me/password", "设置"],
  ])("%s 在右栏保留唯一当前入口", (path, label) => {
    mockUseAuth.mockReturnValue({ user: { id: "u1", username: "用户", avatar: null } });
    mockUsePathname.mockReturnValue(path);
    render(<AppContextRail />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page")).toHaveLength(1);
  });

  test("路径前缀相似时不错误选中账户入口", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1", username: "用户", avatar: null } });
    mockUsePathname.mockReturnValue("/messages-other");
    render(<AppContextRail />);
    expect(screen.getByRole("link", { name: "私聊" })).not.toHaveAttribute("aria-current");
  });

  test("访客只显示注册与登录入口", () => {
    mockUseAuth.mockReturnValue({ user: null });

    render(<AppContextRail />);

    expect(screen.getByRole("link", { name: "注册" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("navigation", { name: "账户快捷入口" })).toBeNull();
  });
});
