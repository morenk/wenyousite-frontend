import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockUseUserActivitySummary, mockRefetch } = vi.hoisted(() => ({
  mockUseUserActivitySummary: vi.fn(),
  mockRefetch: vi.fn(),
}));

vi.mock("@/api/hooks/use-user-activity-summary", () => ({
  useUserActivitySummary: (...args: unknown[]) => mockUseUserActivitySummary(...args),
}));

import { UserActivitySummaryCard } from "@/components/user/user-activity-summary";

describe("UserActivitySummaryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserActivitySummary.mockReturnValue({
      data: {
        momentCount: 7,
        createdThreadCount: 3,
        playedThreadCount: null,
        replyCount: 1280,
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
  });

  afterEach(cleanup);

  test("展示四项精确统计、隐私状态与对应入口", () => {
    render(<UserActivitySummaryCard userId="user-1" />);

    expect(mockUseUserActivitySummary).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("创作概览")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("未公开")).toBeInTheDocument();
    expect(screen.getByText("1,280")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看发布动态" })).toHaveAttribute(
      "href",
      "/users/user-1/moments",
    );
    expect(screen.getByRole("link", { name: "查看创建主题" })).toHaveAttribute(
      "href",
      "/users/user-1/threads",
    );
    expect(screen.queryByRole("link", { name: "查看参与主题" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看累计回复" })).toHaveAttribute(
      "href",
      "#recent-replies",
    );
  });

  test("失败时提供原位重试", () => {
    mockUseUserActivitySummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });
    render(<UserActivitySummaryCard userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(mockRefetch).toHaveBeenCalledOnce();
  });
});
