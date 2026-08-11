import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useAdminUsers: vi.fn((filters: { role?: string }) => filters.role === "ADMIN"
    ? { data: undefined, isLoading: true, isFetching: true }
    : {
        data: { items: [], meta: { cursor: null, hasMore: false } },
        isLoading: false,
        isFetching: false,
      }),
  useAdminUserActions: vi.fn(() => ({
    sanction: { mutateAsync: vi.fn(), isPending: false },
    revoke: { mutateAsync: vi.fn(), isPending: false },
  })),
}));

vi.mock("@/api/hooks/use-admin", () => hooks);

import { UsersPanel } from "./users-panel";

afterEach(() => cleanup());

describe("UsersPanel filters", () => {
  it("选择账号角色后只触发一次可完成的筛选更新", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    render(
      <NuqsTestingAdapter onUrlUpdate={onUrlUpdate} hasMemory>
        <UsersPanel />
      </NuqsTestingAdapter>,
    );

    const roleFilter = within(screen.getByRole("group", { name: "账号角色" })).getByRole("combobox");
    expect(roleFilter.closest("label")).toBeNull();
    await user.click(roleFilter);
    await user.click(screen.getByRole("option", { name: "管理员" }));

    await waitFor(() => {
      expect(hooks.useAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({
        role: "ADMIN",
        limit: 20,
      }));
    });
    expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      searchParams: new URLSearchParams("role=ADMIN"),
    }));
    expect(hooks.useAdminUsers.mock.calls.length).toBeLessThan(10);
  });

  it("从 URL 恢复组合筛选并忽略非法值", () => {
    render(
      <NuqsTestingAdapter searchParams="?q=alice&role=SUPER_ADMIN&status=unknown" hasMemory>
        <UsersPanel />
      </NuqsTestingAdapter>,
    );

    expect(hooks.useAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({
      q: "alice",
      role: "SUPER_ADMIN",
      status: undefined,
      limit: 20,
    }));
  });

  it("组合筛选后可一次重置 URL 和请求条件", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    render(
      <NuqsTestingAdapter onUrlUpdate={onUrlUpdate} hasMemory>
        <UsersPanel />
      </NuqsTestingAdapter>,
    );

    const statusFilter = within(screen.getByRole("group", { name: "处罚状态" })).getByRole("combobox");
    await user.click(statusFilter);
    await user.click(screen.getByRole("option", { name: "暂停" }));

    await waitFor(() => {
      expect(hooks.useAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({
        status: "SUSPENDED",
        limit: 20,
      }));
    });
    await user.click(screen.getByRole("button", { name: "重置" }));

    await waitFor(() => {
      expect(hooks.useAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({
        role: undefined,
        status: undefined,
        limit: 20,
      }));
    });
    expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      searchParams: new URLSearchParams(),
    }));
  });
});
