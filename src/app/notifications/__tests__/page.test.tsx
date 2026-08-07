import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/components/message/message-center-tabs", () => ({
  MessageCenterTabs: () => <nav>消息中心</nav>,
}));
vi.mock("@/components/notification/notification-list", () => ({
  NotificationList: ({ type, onTypeChange }: {
    type?: string;
    onTypeChange: (type?: string) => void;
  }) => (
    <div>
      <span>类型:{type ?? "全部"}</span>
      <button type="button" onClick={() => onTypeChange("system")}>系统通知</button>
      <button type="button" onClick={() => onTypeChange(undefined)}>全部通知</button>
    </div>
  ),
}));

import NotificationsPage from "@/app/notifications/page";

afterEach(() => cleanup());

describe("通知页 URL 筛选", () => {
  test("从 URL 恢复合法类型并忽略非法类型", () => {
    const { unmount } = render(
      <NuqsTestingAdapter searchParams="?type=reply%2Cmention">
        <NotificationsPage />
      </NuqsTestingAdapter>,
    );
    expect(screen.getByText("类型:reply,mention")).toBeInTheDocument();

    unmount();
    render(
      <NuqsTestingAdapter searchParams="?type=unknown">
        <NotificationsPage />
      </NuqsTestingAdapter>,
    );
    expect(screen.getByText("类型:全部")).toBeInTheDocument();
  });

  test("切换和清空类型会更新 URL", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    render(
      <NuqsTestingAdapter onUrlUpdate={onUrlUpdate} hasMemory>
        <NotificationsPage />
      </NuqsTestingAdapter>,
    );

    await user.click(screen.getByRole("button", { name: "系统通知" }));
    expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      searchParams: new URLSearchParams("type=system"),
    }));

    await user.click(screen.getByRole("button", { name: "全部通知" }));
    expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      searchParams: new URLSearchParams(),
    }));
  });
});
