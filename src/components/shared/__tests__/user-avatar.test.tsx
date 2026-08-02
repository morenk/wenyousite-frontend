/** UserAvatar 组件测试：有 URL 用缩略图，无则首字符占位 */

import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UserAvatar } from "@/components/shared/user-avatar";

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

  test("有头像渲染 _thumb.webp 缩略图", () => {
    render(<UserAvatar name="alice" src="https://example.com/uploads/avatar.png" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/uploads/avatar_thumb.webp",
    );
    expect(screen.getByRole("img")).toHaveAttribute("alt", "alice");
    expect(screen.queryByTestId("user-avatar-placeholder")).not.toBeInTheDocument();
  });

  test("svg 头像保持原 URL", () => {
    render(<UserAvatar name="alice" src="https://example.com/icon.svg" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/icon.svg");
  });
});
