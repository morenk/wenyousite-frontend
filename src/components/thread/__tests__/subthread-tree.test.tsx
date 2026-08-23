/** SubthreadTree 章节目录测试 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";
import {
  getReorderedSubthreadIds,
  SubthreadTree,
} from "@/components/thread/subthread-tree";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeSub(
  id: string,
  title: string,
  postingPolicy: "PARTICIPANTS" | "COLLABORATORS" | "PLAYERS" = "PARTICIPANTS",
  posts = 0,
): SubthreadDetail {
  return {
    id,
    threadId: "t1",
    title,
    sortOrder: 0,
    postingPolicy,
    postingCapability: { canPost: true, denialReason: null },
    version: 1,
    lastPostAt: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: null,
    _count: { posts },
  };
}

const subthreads = [
  makeSub("s2", "设定区", "COLLABORATORS", 12),
  makeSub("s3", "剧情区", "PLAYERS", 4),
];

const baseProps = {
  subthreads,
  onSelect: vi.fn(),
  onDelete: vi.fn(),
  onReorder: vi.fn(),
  onCreate: vi.fn(),
};

describe("SubthreadTree", () => {
  test("按真实顺序展示标题、权限与楼层数", () => {
    render(<SubthreadTree {...baseProps} />);

    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("设定区")).toBeInTheDocument();
    expect(screen.getByText("协作者")).toBeInTheDocument();
    expect(screen.getByText("12 楼")).toBeInTheDocument();
    expect(screen.getByText("剧情区")).toBeInTheDocument();
    expect(screen.getByText("玩家")).toBeInTheDocument();
  });

  test("选中章节具有当前位置语义与选中标记", () => {
    render(<SubthreadTree {...baseProps} selectedId="s2" />);

    const selectButton = screen.getByRole("button", { name: "选择子贴「设定区」" });
    expect(selectButton).toHaveAttribute("aria-current", "page");
    expect(selectButton.closest("[data-selected]"))?.toHaveAttribute("data-selected", "true");
  });

  test("点击章节调用 onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SubthreadTree {...baseProps} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "选择子贴「设定区」" }));
    expect(onSelect).toHaveBeenCalledWith("s2");
  });

  test("排序把手与删除操作有独立的可访问名称", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<SubthreadTree {...baseProps} onDelete={onDelete} />);

    expect(screen.getByRole("button", { name: "拖动子贴「设定区」排序" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "删除子贴「设定区」" }));
    expect(onDelete).toHaveBeenCalledWith(subthreads[0]);
  });

  test("点击添加子贴调用 onCreate", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<SubthreadTree {...baseProps} onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: "添加子贴" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  test("排序计算返回真实 ID 顺序并忽略无效落点", () => {
    expect(getReorderedSubthreadIds(subthreads, "s2", "s3")).toEqual(["s3", "s2"]);
    expect(getReorderedSubthreadIds(subthreads, "s2", "s2")).toBeNull();
    expect(getReorderedSubthreadIds(subthreads, "missing", "s3")).toBeNull();
    expect(getReorderedSubthreadIds(subthreads, "s2", "missing")).toBeNull();
    expect(getReorderedSubthreadIds(subthreads, "s2", null)).toBeNull();
  });

  test("保存期间禁用选择、排序、删除和创建", () => {
    render(<SubthreadTree {...baseProps} disabled />);

    expect(screen.getByRole("button", { name: "选择子贴「设定区」" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "拖动子贴「设定区」排序" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "删除子贴「设定区」" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "添加子贴" })).toBeDisabled();
  });
});
