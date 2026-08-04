import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ThreadPermissionsProvider,
  useThreadPermissions,
} from "@/components/thread/thread-permissions-context";

const { mockUseAuth, mockUseMembers } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseMembers: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/api/hooks/use-members", () => ({
  useMembers: () => mockUseMembers(),
}));

function Harness() {
  const permissions = useThreadPermissions();
  return (
    <div>
      <span>{permissions.currentMember?.role ?? "NONE"}</span>
      <span>{permissions.isManager ? "MANAGER" : "READER"}</span>
      <span>{permissions.isAdmin ? "ADMIN" : "USER"}</span>
    </div>
  );
}

describe("ThreadPermissionsProvider", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: "current", role: "USER" } });
    mockUseMembers.mockReturnValue({ data: [], isLoading: false });
  });

  afterEach(cleanup);

  test("根据帖内成员角色识别协作者管理权限", () => {
    mockUseMembers.mockReturnValue({
      data: [
        {
          id: "member-1",
          threadId: "thread-1",
          userId: "current",
          role: "COLLABORATOR",
          playerMarked: false,
          joinedAt: "2026-01-01T00:00:00Z",
          user: { id: "current", username: "协作者", avatar: null },
        },
      ],
      isLoading: false,
    });

    render(
      <ThreadPermissionsProvider threadId="thread-1">
        <Harness />
      </ThreadPermissionsProvider>,
    );

    expect(screen.getByText("COLLABORATOR")).toBeInTheDocument();
    expect(screen.getByText("MANAGER")).toBeInTheDocument();
  });

  test("平台管理员不会自动获得帖内管理角色", () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin", role: "ADMIN" } });

    render(
      <ThreadPermissionsProvider threadId="thread-1">
        <Harness />
      </ThreadPermissionsProvider>,
    );

    expect(screen.getByText("READER")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
  });
});
