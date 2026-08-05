import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { DiceRolls } from "@/components/thread/dice-rolls";

describe("DiceRolls", () => {
  afterEach(() => cleanup());

  test("显示服务端返回的逐骰点数、修正值与总计", () => {
    render(
      <DiceRolls
        rolls={[{
          id: "roll-1",
          postId: "post-1",
          sequence: 1,
          protocolVersion: 1,
          notation: "2d6+3",
          quantity: 2,
          sides: 6,
          modifier: 3,
          results: [2, 5],
          total: 10,
          createdAt: "2026-08-05T00:00:00.000Z",
        }]}
      />,
    );

    expect(screen.getByText("2d6+3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  test("草稿只显示待掷状态，不伪造结果", () => {
    render(<DiceRolls pendingNotations={["1d20"]} />);
    expect(screen.getByText("1d20")).toBeInTheDocument();
    expect(screen.getByText("发布时掷骰")).toBeInTheDocument();
    expect(screen.queryByText("总计")).not.toBeInTheDocument();
  });
});
