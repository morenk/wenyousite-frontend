import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { PostActionsMenu } from "../post-actions-menu";

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/admin/admin-content-moderation-dialog", () => ({ AdminContentModerationDialog: () => null }));
afterEach(cleanup);

test("共享菜单保留删除未决保护，完成后恢复危险操作及触发焦点", async () => {
  const onDelete = vi.fn();
  const user = userEvent.setup();
  const props = { triggerLabel: "楼层操作", menuLabel: "楼层菜单", copyText: () => "内容", copyHref: "/threads/t1", onDelete };
  const { rerender } = render(<PostActionsMenu {...props} deletePending />);
  const trigger = screen.getByRole("button", { name: "楼层操作" });
  await user.click(trigger);
  const remove = screen.getByRole("menuitem", { name: "删除" });
  expect(remove).toHaveAttribute("data-destructive", "true");
  expect(remove).toHaveAttribute("aria-disabled", "true");
  await user.keyboard("{End}");
  expect(remove).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(onDelete).not.toHaveBeenCalled();
  rerender(<PostActionsMenu {...props} deletePending={false} />);
  expect(remove).not.toHaveAttribute("aria-disabled", "true");
  await user.keyboard("{Enter}");
  expect(onDelete).toHaveBeenCalledOnce();
  await waitFor(() => expect(trigger).toHaveFocus());
});
