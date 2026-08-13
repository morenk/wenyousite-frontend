import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockShellContext,
  mockUserCreatedThreads,
  mockUserPlayedThreads,
} = vi.hoisted(() => ({
  mockShellContext: vi.fn(),
  mockUserCreatedThreads: vi.fn(),
  mockUserPlayedThreads: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "author-1" }) }));
vi.mock("@/components/user/user-profile-shell", () => ({
  useUserProfilePageContext: () => mockShellContext(),
}));
vi.mock("@/components/user/user-created-threads", () => ({
  UserCreatedThreads: (props: unknown) => {
    mockUserCreatedThreads(props);
    return <div>创建列表</div>;
  },
}));
vi.mock("@/components/user/user-played-threads", () => ({
  UserPlayedThreads: (props: unknown) => {
    mockUserPlayedThreads(props);
    return <div>参与列表</div>;
  },
}));

import UserThreadsRoute from "@/app/users/[id]/(profile)/threads/page";

describe("用户帖子 Tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShellContext.mockReturnValue({ canViewPlayedThreads: true, isSelf: true });
  });
  afterEach(cleanup);

  test("创建与参与使用二级切换且只挂载当前列表", () => {
    render(<UserThreadsRoute />);

    expect(screen.getByText("创建列表")).toBeInTheDocument();
    expect(mockUserCreatedThreads).toHaveBeenCalledWith({ userId: "author-1" });
    expect(mockUserPlayedThreads).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "参与的" }));
    expect(screen.getByText("参与列表")).toBeInTheDocument();
    expect(screen.queryByText("创建列表")).not.toBeInTheDocument();
    expect(mockUserPlayedThreads).toHaveBeenCalledWith({ userId: "author-1", isSelf: true });
  });

  test("参与内容未公开时隐藏二级入口且不挂载查询", () => {
    mockShellContext.mockReturnValue({ canViewPlayedThreads: false, isSelf: false });
    render(<UserThreadsRoute />);

    expect(screen.queryByRole("tab", { name: "参与的" })).not.toBeInTheDocument();
    expect(screen.getByText("创建列表")).toBeInTheDocument();
    expect(mockUserPlayedThreads).not.toHaveBeenCalled();
  });
});
