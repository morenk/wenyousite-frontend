/** ThreadDraftPicker 组件测试：标题 + 新建按钮 + 草稿列表挂载 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";

const { mockCreateNew } = vi.hoisted(() => ({ mockCreateNew: vi.fn() }));

vi.mock("@/components/user/draft-list", () => ({
  DraftList: () => <div data-testid="draft-list">草稿列表</div>,
}));

import { ThreadDraftPicker } from "@/components/thread/thread-draft-picker";

afterEach(() => cleanup());

describe("ThreadDraftPicker", () => {
  test("渲染标题、新建按钮与草稿列表", () => {
    render(<ThreadDraftPicker onCreateNew={mockCreateNew} />);
    expect(screen.getByText("创建主题帖")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建主题帖" })).toBeInTheDocument();
    expect(screen.getByTestId("draft-list")).toBeInTheDocument();
  });

  test("点击「新建主题帖」触发 onCreateNew 回调", async () => {
    const user = userEvent.setup();
    render(<ThreadDraftPicker onCreateNew={mockCreateNew} />);
    await user.click(screen.getByRole("button", { name: "新建主题帖" }));
    expect(mockCreateNew).toHaveBeenCalledTimes(1);
  });
});
