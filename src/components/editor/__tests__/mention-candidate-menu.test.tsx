import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MentionCandidateMenu } from "@/components/editor/mention-candidate-menu";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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
    const menu = screen.getByRole("listbox", { name: "艾特候选" });
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveClass("fixed", "z-[var(--layer-nested-popup)]");
    expect(menu).toHaveStyle({ top: "20px" });
    // jsdom 不计算嵌套 CSS clamp/min；左右边界由真实 Chromium 组件截图回归覆盖。
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
    expect(screen.getByText("玩家")).toBeInTheDocument();
    expect(screen.getByText("我关注的人")).toBeInTheDocument();
    const active = screen.getByRole("option", { name: /玩家一/ });
    expect(active).toHaveAttribute("aria-selected", "true");
    fireEvent.mouseDown(active);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

test("重名角色通过账号区分且选择仍携带账号 ID", () => {
  const select = vi.fn();
  render(<MentionCandidateMenu {...baseProps} onSelect={select} items={[
    { id: "u1", username: "白鸦", label: "@白鸦", accountUsername: "小明", avatar: null, relation: "PLAYER" },
    { id: "u2", username: "白鸦", label: "@白鸦", accountUsername: "小红", avatar: "https://example.com/rp.webp", relation: "PLAYER" },
  ]} />);
  const option = screen.getByRole("option", { name: /@小红/ });
  expect(option).toHaveAttribute("data-mention-id", "u2");
  expect(screen.getByRole("img", { name: "白鸦" })).toHaveAttribute("src", "https://example.com/rp.webp");
  fireEvent.mouseDown(option);
  expect(select).toHaveBeenCalledOnce();
});

test("同账号的重名角色使用不同候选键，长列表滚动到键盘选中项", () => {
  const original = HTMLElement.prototype.scrollIntoView;
  const scroll = vi.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  try {
    const selected: string[] = [];
    const items = Array.from({ length: 11 }, (_, index) => ({
      id: "target-" + index, username: "白鸦", label: "@白鸦", accountUsername: "小明",
      relation: "PLAYER" as const,
    }));
    const onSelect: typeof baseProps.onSelect = (event) => selected.push(event.currentTarget.dataset.mentionId!);
    const view = render(<MentionCandidateMenu {...baseProps} items={items} onSelect={onSelect} />);
    expect(screen.getByRole("listbox")).toHaveClass("overflow-y-auto");
    expect(screen.getByRole("listbox")).toHaveStyle({ maxHeight: "320px" });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(11);
    fireEvent.mouseDown(options[0]!); fireEvent.mouseDown(options[1]!);
    expect(selected).toEqual(["target-0", "target-1"]);
    view.rerender(<MentionCandidateMenu {...baseProps} items={items} activeIndex={10} onSelect={onSelect} />);
    expect(options[10]).toHaveAttribute("aria-selected", "true");
    expect(scroll).toHaveBeenLastCalledWith({ block: "nearest" });
    expect(scroll.mock.contexts.at(-1)).toBe(options[10]);
  } finally { HTMLElement.prototype.scrollIntoView = original; }
});

test("用户提及关闭与搜索无匹配使用不同状态，不妨碍全体玩家入口", () => {
  const view = render(<MentionCandidateMenu {...baseProps} userMentionsUnavailable />);
  expect(screen.getByRole("status")).toHaveTextContent("暂时无法提及用户");
  expect(screen.queryByText("暂无可艾特用户")).not.toBeInTheDocument();
  view.rerender(<MentionCandidateMenu {...baseProps} userMentionsUnavailable items={[
    { id: "all-players", label: "全体玩家", isGroup: true },
  ]} />);
  expect(screen.getByRole("option", { name: /全体玩家/ })).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("同账号同名同头像才显示序号，点击仍使用完整角色键", () => {
  const selected: string[] = [];
  render(<MentionCandidateMenu {...baseProps} onSelect={(event) => selected.push(event.currentTarget.dataset.mentionId!)} items={[
    { id: "RP:a", label: "@白鸦", accountUsername: "账号", avatar: null },
    { id: "RP:b", label: "@白鸦", accountUsername: "账号", avatar: null },
    { id: "RP:c", label: "@白鸦", accountUsername: "账号", avatar: "/c.png" },
  ]} />);
  fireEvent.mouseDown(screen.getByRole("option", { name: "白鸦，@账号，同名身份2" }));
  expect(selected).toEqual(["RP:b"]);
  expect(screen.getByRole("option", { name: "白鸦，@账号，同名身份1" })).toHaveTextContent("1");
  expect(screen.getAllByRole("option")[2]!).not.toHaveAttribute("aria-label");
});

test("选择行复用头像与上下名称，去掉名称前重复艾特和右侧关系列", () => {
  render(<MentionCandidateMenu {...baseProps} items={[
    { id: "RP:a", label: "@白鸦", accountUsername: "小明", avatar: null, relation: "PLAYER" },
  ]} />);
  const option = screen.getByRole("option");
  expect(option).toHaveTextContent("白鸦");
  expect(option).toHaveTextContent("@小明");
  expect(option).not.toHaveTextContent("@白鸦");
  expect(option).not.toHaveTextContent("帖内玩家");
  expect(option.querySelector(".lucide-at-sign")).toBeNull();
  expect(option).toHaveClass("bg-accent");
});


test("保留根元素 scrollbar gutter 的可用宽度，缩放或调整窗口后重新约束", () => {
  vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(360);
  const rect = vi.spyOn(document.documentElement, "getBoundingClientRect")
    .mockReturnValue({ width: 345 } as DOMRect);
  render(<MentionCandidateMenu {...baseProps} position={{ top: 180, left: 64 }} />);
  const menu = screen.getByRole("listbox");
  expect(menu).toHaveStyle({ maxWidth: "329px" });

  rect.mockReturnValue({ width: 300 } as DOMRect);
  fireEvent.resize(window);
  expect(menu).toHaveStyle({ maxWidth: "284px" });

});
