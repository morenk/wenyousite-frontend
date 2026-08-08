import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/components/moment/moment-composer", () => ({
  MomentComposer: ({ open, userId }: { open: boolean; userId: string }) => open ? (
    <div role="dialog" aria-label="动态发布器">{userId}</div>
  ) : null,
}));

import { PublishMenu } from "@/components/layout/publish-menu";

describe("PublishMenu", () => {
  afterEach(cleanup);

  test("文楷发布按钮展开主题帖与动态两个入口", async () => {
    render(<PublishMenu userId="user-1" />);

    const trigger = screen.getByRole("button", { name: "打开发布菜单" });
    expect(screen.getByText("发布")).toHaveClass("font-display");
    expect(trigger).toHaveClass("bg-primary", "rounded-2xl");
    await userEvent.click(trigger);

    expect(await screen.findByRole("navigation", { name: "发布选项" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /发布主题帖/ })).toHaveAttribute("href", "/threads/create");
    await userEvent.click(screen.getByRole("button", { name: /发布动态/ }));
    expect(screen.getByRole("dialog", { name: "动态发布器" })).toHaveTextContent("user-1");
  });
});
