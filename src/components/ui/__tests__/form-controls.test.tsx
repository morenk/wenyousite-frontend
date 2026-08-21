import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

afterEach(cleanup);

describe("共享表单控件", () => {
  test("FormField 把标签、说明与错误关联到控件", () => {
    render(
      <FormField
        id="email"
        label="邮箱"
        description="用于接收验证码"
        error="邮箱格式不正确"
      >
        {(controlProps) => <Input {...controlProps} />}
      </FormField>,
    );

    const input = screen.getByLabelText("邮箱");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "email-description email-error",
    );
    expect(screen.getByText("用于接收验证码")).toHaveAttribute("id", "email-description");
    expect(screen.getByText("邮箱格式不正确")).toHaveAttribute("id", "email-error");
  });

  test("PasswordInput 使用语义图标切换密码可见性并合并样式", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="密码" className="test-width" />);

    const input = screen.getByLabelText("密码");
    const toggle = screen.getByRole("button", { name: "显示密码" });
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveClass("pr-11", "test-width");
    expect(toggle.querySelector("svg")).toHaveAttribute("data-icon-semantic", "action.show");

    await user.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "隐藏密码" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "隐藏密码" }).querySelector("svg"))
      .toHaveAttribute("data-icon-semantic", "action.hide");
  });
});
