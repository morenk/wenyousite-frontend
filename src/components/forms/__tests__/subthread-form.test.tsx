/** SubthreadForm 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubthreadForm } from "@/components/forms/subthread-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SubthreadForm", () => {
  test("创建模式渲染正确标题", () => {
    render(
      <SubthreadForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("dialog", { name: "添加子贴" })).toBeInTheDocument();
  });

  test("编辑模式渲染正确标题", () => {
    render(
      <SubthreadForm mode="edit" onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText("编辑子贴")).toBeInTheDocument();
  });

  test("编辑模式下回填默认值", () => {
    render(
      <SubthreadForm
        mode="edit"
        defaultValues={{
          title: "设定区",
          postingPolicy: "COLLABORATORS",
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("设定区")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "发帖权限" })).toHaveTextContent("协作者");
  });

  test("创建模式下按钮文案为'添加'", () => {
    render(
      <SubthreadForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText("添加")).toBeInTheDocument();
  });

  test("编辑模式下按钮文案为'保存'", () => {
    render(
      <SubthreadForm mode="edit" onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText("保存")).toBeInTheDocument();
  });

  test("标题为空时显示校验错误", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <SubthreadForm mode="create" onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    await user.click(screen.getByText("添加"));

    expect(
      screen.getByText("请输入子贴标题"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("填写标题并选择权限后提交成功", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <SubthreadForm mode="create" onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    await user.type(screen.getByPlaceholderText("主帖 / 设定区 / 剧情区"), "新子贴");
    await user.click(screen.getByRole("combobox", { name: "发帖权限" }));
    await user.click(await screen.findByRole("option", { name: "仅玩家" }));
    await user.click(screen.getByText("添加"));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "新子贴",
          postingPolicy: "PLAYERS",
        }),
      );
    });
  });

  test("点击取消调用 onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <SubthreadForm mode="create" onSubmit={vi.fn()} onCancel={onCancel} />,
    );

    await user.click(screen.getByText("取消"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("Esc 关闭弹层并调用 onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <SubthreadForm mode="create" onSubmit={vi.fn()} onCancel={onCancel} />,
    );

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("isSubmitting 时禁用按钮", () => {
    render(
      <SubthreadForm
        mode="create"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isSubmitting
      />,
    );

    expect(screen.getByText("添加")).toBeDisabled();
    expect(screen.getByText("取消")).toBeDisabled();
  });
});
