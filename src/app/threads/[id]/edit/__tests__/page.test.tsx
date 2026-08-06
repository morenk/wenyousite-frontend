/** 主题帖编辑页测试：未发布草稿与已发布帖子使用不同表单 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  thread: {
    id: "thread-1",
    ownerId: "user-1",
    published: false,
  },
  replace: vi.fn(),
  push: vi.fn(),
  refetch: vi.fn(),
  deleteDraft: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "thread-1" }),
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "user-1", emailVerified: true },
    isInitialized: true,
  }),
}));

vi.mock("@/api/hooks/use-thread-detail", () => ({
  useThreadDetail: () => ({
    data: mocks.thread,
    isLoading: false,
    error: null,
    refetch: mocks.refetch,
  }),
}));

vi.mock("@/components/thread/thread-permissions-context", () => ({
  ThreadPermissionsProvider: ({ children }: { children: ReactNode }) => children,
  useThreadPermissions: () => ({
    isOwner: true,
    isCollaborator: false,
    isLoading: false,
  }),
}));

vi.mock("@/api/hooks/use-delete-thread", () => ({
  useDeleteThread: () => ({ mutateAsync: mocks.deleteDraft }),
}));

vi.mock("@/components/forms/thread-create-form", () => ({
  ThreadCreateForm: ({
    onPublished,
  }: {
    onPublished: (threadId: string) => void;
  }) => (
    <div>
      <span>草稿创建表单</span>
      <button onClick={() => onPublished("thread-1")}>模拟发布</button>
    </div>
  ),
}));

vi.mock("@/components/thread/management-panel", () => ({
  ManagementPanel: ({ initialView }: { initialView?: string }) => (
    <div>统一管理面板 initialView={initialView}</div>
  ),
}));

import EditThreadPage from "../page";

describe("EditThreadPage", () => {
  beforeEach(() => {
    mocks.thread.published = false;
    mocks.replace.mockReset();
    mocks.push.mockReset();
    mocks.refetch.mockReset();
    mocks.deleteDraft.mockReset();
  });

  afterEach(cleanup);

  test("未发布草稿渲染可保存草稿和发布的创建表单", () => {
    render(<EditThreadPage />);

    expect(screen.getByText("继续编辑草稿")).toBeInTheDocument();
    expect(screen.getByText("草稿创建表单")).toBeInTheDocument();
    expect(screen.queryByText(/统一管理面板/)).not.toBeInTheDocument();
  });

  test("草稿发布后跳转主题帖详情页", async () => {
    const user = userEvent.setup();
    render(<EditThreadPage />);

    await user.click(screen.getByRole("button", { name: "模拟发布" }));
    expect(mocks.replace).toHaveBeenCalledWith("/threads/thread-1");
  });

  test("已发布帖子复用统一管理面板并默认进入主题帖页签", () => {
    mocks.thread.published = true;
    render(<EditThreadPage />);

    expect(screen.getByText("统一管理面板 initialView=thread")).toBeInTheDocument();
    expect(screen.queryByText("草稿创建表单")).not.toBeInTheDocument();
  });
});
