import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MentionCandidateMenu } from "@/components/editor/mention-candidate-menu";

afterEach(() => cleanup());

const baseProps: React.ComponentProps<typeof MentionCandidateMenu> = {
  position: { top: 20, left: 30 },
  items: [],
  activeIndex: 0,
  pending: false,
  error: false,
  onRetry: vi.fn(),
  onSelect: vi.fn(),
};

describe("MentionCandidateMenu", () => {
  test("没有位置时不渲染", () => {
    const { container } = render(<MentionCandidateMenu {...baseProps} position={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("区分加载、错误和空态", () => {
    const loading = render(<MentionCandidateMenu {...baseProps} pending />);
    expect(screen.getByRole("status")).toHaveTextContent("正在查找可艾特用户");
    loading.unmount();

    const retry = vi.fn();
    const error = render(<MentionCandidateMenu {...baseProps} error onRetry={retry} />);
    fireEvent.mouseDown(screen.getByRole("button", { name: "加载失败，点击重试" }));
    expect(retry).toHaveBeenCalledOnce();
    error.unmount();

    render(<MentionCandidateMenu {...baseProps} />);
    expect(screen.getByText("暂无可艾特用户")).toBeInTheDocument();
  });

  test("渲染关系文案、当前项并转发选择事件", () => {
    const onSelect = vi.fn();
    render(<MentionCandidateMenu
      {...baseProps}
      items={[
        { id: "all", label: "所有玩家", isGroup: true },
        { id: "u1", label: "玩家一", relation: "PLAYER" },
        { id: "u2", label: "关注用户", relation: "FOLLOWING" },
      ]}
      activeIndex={1}
      onSelect={onSelect}
    />);

    expect(screen.getByText("仅楼主/协作者")).toBeInTheDocument();
    expect(screen.getByText("帖内玩家")).toBeInTheDocument();
    expect(screen.getByText("我关注的人")).toBeInTheDocument();
    const active = screen.getByRole("option", { name: /玩家一/ });
    expect(active).toHaveAttribute("aria-selected", "true");
    fireEvent.mouseDown(active);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
