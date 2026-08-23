/** UserAvatar 组件测试：有 URL 用头像母版，无则首字符占位 */

import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { UserAvatar, UserAvatarLink } from "@/components/shared/user-avatar";

afterEach(() => cleanup());

describe("UserAvatar", () => {
  test("无头像显示用户名首字符占位", () => {
    render(<UserAvatar name="alice" src={null} className="h-9 w-9" />);
    expect(screen.getByTestId("user-avatar-placeholder").textContent).toBe("A");
  });

  test("无头像占位应用传入尺寸与字号", () => {
    render(
      <UserAvatar name="tester" src={null} className="h-6 w-6" textClassName="text-[10px]" />,
    );
    const el = screen.getByTestId("user-avatar-placeholder");
    expect(el.className).toContain("h-6");
    expect(el.className).toContain("w-6");
    expect(el.className).toContain("text-[10px]");
  });

  test("有头像直接使用接口返回的母版 URL", () => {
    render(<UserAvatar name="alice" src="https://example.com/uploads/avatar.png" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/uploads/avatar.png",
    );
    expect(screen.getByRole("img")).toHaveAttribute("alt", "alice");
    expect(screen.queryByTestId("user-avatar-placeholder")).not.toBeInTheDocument();
  });

  test("svg 头像保持原 URL", () => {
    render(<UserAvatar name="alice" src="https://example.com/icon.svg" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/icon.svg");
  });

  test("头像加载失败后降级为首字符", () => {
    render(<UserAvatar name="南枝" src="https://example.com/uploads/broken.png" />);
    fireEvent.error(screen.getByRole("img", { name: "南枝" }));

    expect(screen.getByTestId("user-avatar-placeholder")).toHaveTextContent("南");
    expect(screen.getByTestId("user-avatar-placeholder")).toHaveAttribute(
      "data-avatar-fallback",
      "first-readable-character",
    );
  });

  test("已注销用户统一显示灰色用户图标且忽略旧头像", () => {
    render(
      <UserAvatar
        name="已注销用户"
        src="https://example.com/old-avatar.png"
        className="h-9 w-9"
      />,
    );

    const avatar = screen.getByTestId("deactivated-user-avatar");
    expect(avatar.className).toContain("bg-muted");
    expect(avatar.className).toContain("text-muted-foreground");
    expect(screen.getByRole("img", { name: "已注销用户头像" })).toBe(avatar);
    expect(avatar.querySelector("img")).toBeNull();
  });

  test("可点击头像提供用户主页链接与明确名称", () => {
    render(<UserAvatarLink userId="user-1" name="alice" src={null} className="size-8" />);

    expect(screen.getByRole("link", { name: "查看alice的用户主页" })).toHaveAttribute(
      "href",
      "/users/user-1",
    );
  });
});
