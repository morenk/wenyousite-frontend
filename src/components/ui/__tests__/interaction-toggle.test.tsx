import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InteractionToggle } from "@/components/ui/interaction-toggle";

describe("InteractionToggle", () => {
  afterEach(cleanup);

  it("为未选中的互动保留稳定名称、计数说明和中性色", () => {
    render(
      <InteractionToggle
        tone="like"
        pressed={false}
        icon="action.like"
        accessibleName="点赞"
        accessibleDescription="当前 2 个赞"
        actionTitle="点赞（当前 2）"
      >
        2
      </InteractionToggle>,
    );

    const button = screen.getByRole("button", { name: "点赞" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAccessibleDescription("当前 2 个赞");
    expect(button).toHaveAttribute("title", "点赞（当前 2）");
    expect(button).toHaveClass("text-muted-foreground");
    expect(button).not.toHaveClass("bg-like-soft");
    expect(button.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveAttribute("data-icon-semantic", "action.like");
    expect(button.querySelector('[data-slot="interaction-toggle-icon"]'))
      .not.toHaveClass("fill-like", "text-like");
  });

  it("只把点赞图标染成鲜粉色，并让计数保持正文色", () => {
    render(
      <InteractionToggle
        tone="like"
        pressed
        icon="action.like"
        accessibleName="点赞"
        accessibleDescription="当前 8 个赞"
      >
        <span data-testid="count">8</span>
      </InteractionToggle>,
    );

    const button = screen.getByRole("button", { name: "点赞" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass("bg-like-soft", "text-foreground");
    expect(button.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveClass("fill-like", "text-like");
    expect(screen.getByTestId("count")).not.toHaveClass("text-like");
  });

  it("只把收藏图标染成金色，并为选中态使用金色柔和底", () => {
    render(
      <InteractionToggle
        tone="bookmark"
        pressed
        icon="action.bookmark"
        accessibleName="收藏"
      >
        已收藏
      </InteractionToggle>,
    );

    const button = screen.getByRole("button", { name: "收藏" });
    expect(button).toHaveClass("bg-bookmark-soft", "text-foreground");
    expect(button.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveClass("fill-bookmark", "text-bookmark");
  });

  it("请求中保持原选中视觉与焦点能力，并阻止重复提交", () => {
    const onClick = vi.fn();
    render(
      <InteractionToggle
        tone="bookmark"
        pressed
        pending
        icon="action.bookmark"
        accessibleName="收藏"
        onClick={onClick}
      >
        已收藏
      </InteractionToggle>,
    );

    const button = screen.getByRole("button", { name: "收藏" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    expect(button).toHaveClass("bg-bookmark-soft", "text-foreground");
    expect(button.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveAttribute("data-icon-semantic", "status.loading");
    expect(button.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveClass("animate-spin", "motion-reduce:animate-none", "text-bookmark");
    expect(button.querySelector('[data-slot="interaction-toggle-icon"]'))
      .not.toHaveClass("fill-bookmark");

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("通用切换沿用 accent，显式禁用时使用原生 disabled", () => {
    render(
      <InteractionToggle
        pressed
        disabled
        icon="action.like"
        accessibleName="订阅官方更新"
      />,
    );

    const button = screen.getByRole("button", { name: "订阅官方更新" });
    expect(button).toBeDisabled();
    expect(button).toHaveClass(
      "bg-accent",
      "text-accent-foreground",
      "disabled:opacity-[var(--icon-control-disabled-content-opacity)]",
    );
  });
});
