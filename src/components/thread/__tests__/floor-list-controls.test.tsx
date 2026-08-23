import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FloorListControls } from "@/components/thread/floor-list-controls";

afterEach(cleanup);

const authors = [
  {
    id: "owner-1",
    username: "楼主甲",
    avatar: null,
    level: 3,
    role: "OWNER" as const,
    playerMarked: false,
  },
  {
    id: "player-1",
    username: "玩家乙",
    avatar: null,
    level: 2,
    role: "PARTICIPANT" as const,
    playerMarked: true,
  },
];

describe("FloorListControls", () => {
  test("时间顺序用单击按钮直接切换", async () => {
    const user = userEvent.setup();
    const onOrderChange = vi.fn();
    render(
      <FloorListControls
        order="OLDEST"
        onOrderChange={onOrderChange}
        onAuthorChange={vi.fn()}
        authors={authors}
        authorsLoading={false}
        authorsError={false}
        onRetryAuthors={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", { name: "楼层排序" });
    expect(toggle).toHaveTextContent("最早在前");
    await user.click(toggle);
    expect(onOrderChange).toHaveBeenCalledWith("NEWEST");
    expect(screen.queryByText("楼层排序")).not.toBeInTheDocument();
  });

  test("可从当前子贴候选中只看某人", async () => {
    const user = userEvent.setup();
    const onAuthorChange = vi.fn();
    render(
      <FloorListControls
        order="NEWEST"
        onOrderChange={vi.fn()}
        onAuthorChange={onAuthorChange}
        authors={authors}
        authorsLoading={false}
        authorsError={false}
        onRetryAuthors={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "只看某人的楼层" }));
    await user.click(screen.getByRole("option", { name: "玩家乙 玩家" }));
    expect(onAuthorChange).toHaveBeenCalledWith("player-1");
  });

  test("候选失败时提供重试入口", async () => {
    const user = userEvent.setup();
    const onRetryAuthors = vi.fn();
    render(
      <FloorListControls
        order="OLDEST"
        onOrderChange={vi.fn()}
        onAuthorChange={vi.fn()}
        authors={[]}
        authorsLoading={false}
        authorsError
        onRetryAuthors={onRetryAuthors}
      />,
    );

    await user.click(screen.getByRole("button", { name: "重新加载作者" }));
    expect(onRetryAuthors).toHaveBeenCalledOnce();
  });

  test("候选加载和空结果都有明确的禁用状态", () => {
    const commonProps = {
      order: "OLDEST" as const,
      onOrderChange: vi.fn(),
      onAuthorChange: vi.fn(),
      authors: [],
      authorsError: false,
      onRetryAuthors: vi.fn(),
    };
    const { rerender } = render(
      <FloorListControls {...commonProps} authorsLoading />,
    );

    expect(screen.getByRole("button", { name: "正在加载楼层作者" })).toBeDisabled();
    rerender(<FloorListControls {...commonProps} authorsLoading={false} />);
    expect(
      screen.getByRole("button", { name: "当前楼层暂无可筛选作者" }),
    ).toBeDisabled();
  });
});
