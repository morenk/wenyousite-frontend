/** 认证页面品牌壳测试：统一消费 Foundation 标识和正式品牌文案。 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { AuthPageShell } from "@/components/auth/auth-page-shell";

afterEach(() => cleanup());

describe("AuthPageShell", () => {
  test("桌面与窄屏入口使用无背景的 Foundation 品牌标识", () => {
    const { container } = render(
      <AuthPageShell title="登录">
        <p>表单内容</p>
      </AuthPageShell>,
    );

    expect(screen.getAllByRole("link", { name: "温油站首页" })).toHaveLength(2);
    expect(screen.getByText("最温油的文字共创社区")).toBeInTheDocument();
    expect(screen.queryByText("测试说明")).not.toBeInTheDocument();

    const marks = container.querySelectorAll('img[src*="brand-title-icon-128.png"]');
    expect(marks).toHaveLength(2);
    for (const mark of marks) {
      expect(mark).toHaveAttribute("alt", "");
      expect(mark).toHaveAttribute("aria-hidden", "true");
      expect(mark.parentElement).not.toHaveClass("bg-primary");
    }
  });
});
