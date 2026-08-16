import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FloorOrderControl } from "@/components/thread/floor-order-control";

afterEach(cleanup);

describe("FloorOrderControl", () => {
  test("展示当前顺序并可切换为最新楼层在前", async () => {
    const user = userEvent.setup();
    const onOrderChange = vi.fn();
    render(<FloorOrderControl order="OLDEST" onOrderChange={onOrderChange} />);

    expect(screen.getByRole("combobox", { name: "楼层排序" })).toHaveTextContent(
      "最早楼层在前",
    );
    await user.click(screen.getByRole("combobox", { name: "楼层排序" }));
    await user.click(screen.getByRole("option", { name: "最新楼层在前" }));

    expect(onOrderChange).toHaveBeenCalledWith("NEWEST");
  });
});
