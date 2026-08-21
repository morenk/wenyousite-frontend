import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockReplace,
  mockUseAuth,
  mockUseInvitePreview,
  mockUseJoinThreadByInvite,
} = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseInvitePreview: vi.fn(),
  mockUseJoinThreadByInvite: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "invite-token" }),
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/join/invite-token",
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));

vi.mock("@/api/hooks/use-thread-access-actions", () => ({
  useInvitePreview: (...args: unknown[]) => mockUseInvitePreview(...args),
  useJoinThreadByInvite: () => mockUseJoinThreadByInvite(),
}));

import JoinByInvitePage from "@/app/join/[token]/page";

const thread = {
  id: "t1",
  title: "私密帖",
  category: "RPG",
  status: "RECRUITING",
  owner: { id: "u1", username: "楼主", avatar: null },
  memberCount: 2,
  createdAt: "2026-08-01T00:00:00Z",
};

describe("私密帖邀请页", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "u2" }, isInitialized: true });
    mockUseJoinThreadByInvite.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
  });

  test("已是参与人时直接进入私密帖，不停留在接受邀请界面", async () => {
    mockUseInvitePreview.mockReturnValue({
      data: { thread, alreadyJoined: true },
      isLoading: false,
      error: null,
    });

    render(<JoinByInvitePage />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/threads/t1"));
    expect(screen.queryByRole("button", { name: "接受邀请并加入" })).not.toBeInTheDocument();
  });

  test("尚未加入时仍显示邀请确认", () => {
    mockUseInvitePreview.mockReturnValue({
      data: { thread, alreadyJoined: false },
      isLoading: false,
      error: null,
    });

    render(<JoinByInvitePage />);

    expect(screen.getByRole("button", { name: "接受邀请并加入" })).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalledWith("/threads/t1");
  });

  test("未登录时保留邀请页的查询参数与锚点", async () => {
    window.history.replaceState(null, "", "/join/invite-token?source=share#accept");
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    mockUseInvitePreview.mockReturnValue({ data: undefined, isLoading: false, error: null });

    render(<JoinByInvitePage />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(
      "/login?next=%2Fjoin%2Finvite-token%3Fsource%3Dshare%23accept",
    ));
    expect(mockUseInvitePreview).toHaveBeenCalledWith(undefined);
  });
});
