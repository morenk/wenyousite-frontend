import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { Menu } from "@/components/ui/menu";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

describe("共享菜单", () => {
  it("键盘可识别但不能激活禁用项、执行危险项并恢复触发焦点", async () => {
    const remove = vi.fn();
    const disabled = vi.fn();
    const user = userEvent.setup();
    render(<Menu.Root><Menu.Trigger tooltip="更多操作" render={<Button aria-label="更多操作" />}>菜单</Menu.Trigger>
      <Menu.Content aria-label="操作菜单"><Menu.Item>编辑</Menu.Item><Menu.Item disabled onClick={disabled}>不可操作</Menu.Item><Menu.Separator /><Menu.Item destructive onClick={remove}>删除</Menu.Item></Menu.Content>
    </Menu.Root>);
    const trigger = screen.getByRole("button", { name: "更多操作" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "编辑" })).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "不可操作" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(disabled).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "删除" })).toHaveFocus();
    expect(screen.getByRole("menuitem", { name: "删除" })).toHaveAttribute("data-destructive", "true");
    await user.keyboard("{Enter}");
    expect(remove).toHaveBeenCalledOnce();
    expect(disabled).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.keyboard("{ArrowDown}{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("带提示的禁用入口不会打开菜单", async () => {
    const user = userEvent.setup();
    render(<Menu.Root><Menu.Trigger disabled tooltip="更多操作" render={<Button aria-label="更多操作" />}>菜单</Menu.Trigger><Menu.Content><Menu.Item>编辑</Menu.Item></Menu.Content></Menu.Root>);
    const trigger = screen.getByRole("button", { name: "更多操作" });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("保留单选组与独立编辑动作，编辑不改变当前选项", async () => {
    const edit = vi.fn();
    function Example() {
      const [value, setValue] = useState("account");
      return <Menu.Root><Menu.Trigger>身份</Menu.Trigger><Menu.Content aria-label="身份菜单">
        <Menu.RadioGroup value={value} onValueChange={setValue}>
          <Menu.RadioItem density="rich" value="account">站内身份</Menu.RadioItem>
          <Menu.RadioItem density="rich" closeOnClick value="roleplay">帖内身份</Menu.RadioItem>
          <Menu.Item density="rich" onClick={edit}>编辑帖内资料</Menu.Item>
        </Menu.RadioGroup></Menu.Content></Menu.Root>;
    }
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("button", { name: "身份" }));
    expect(screen.getByRole("menuitemradio", { name: "站内身份" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "帖内身份" }));
    await user.click(screen.getByRole("button", { name: "身份" }));
    expect(screen.getByRole("menuitemradio", { name: "帖内身份" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitem", { name: "编辑帖内资料" }));
    expect(edit).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "身份" }));
    expect(screen.getByRole("menuitemradio", { name: "帖内身份" })).toHaveAttribute("aria-checked", "true");
  });
});
