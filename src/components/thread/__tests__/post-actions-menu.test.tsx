import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { PostActionsMenu } from "../post-actions-menu";

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/admin/admin-content-moderation-dialog", () => ({ AdminContentModerationDialog: () => null }));
const clipboard = vi.hoisted(() => ({ plain: vi.fn(), rich: vi.fn(), payload: vi.fn() }));
vi.mock("@/lib/tools/clipboard", () => ({ copyToolText: clipboard.plain }));
vi.mock("@/lib/site-clipboard", () => ({ writeSiteClipboardPayload: clipboard.rich, createReaderClipboardPayload: clipboard.payload }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from "sonner";
afterEach(() => { cleanup(); vi.clearAllMocks(); });

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

test("普通内容和链接复制失败不误报成功，富文本保留站内协议", async () => {
  const user = userEvent.setup();
  const props = { triggerLabel: "楼层操作", menuLabel: "楼层菜单", copyText: () => "纯文本", copyHref: "/threads/t1" };
  const view = render(<PostActionsMenu {...props} />);
  clipboard.plain.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await user.click(screen.getByRole("button", { name: "楼层操作" }));
  await user.click(screen.getByRole("menuitem", { name: "复制内容" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("复制失败，请稍后重试"));
  expect(toast.success).not.toHaveBeenCalled();
  expect(clipboard.plain).toHaveBeenCalledWith("纯文本");
  await user.click(screen.getByRole("button", { name: "楼层操作" }));
  await user.click(screen.getByRole("menuitem", { name: "复制链接" }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("链接已复制"));
  expect(clipboard.plain).toHaveBeenLastCalledWith(`${window.location.origin}/threads/t1`);
  view.rerender(<><div id="rich-body" data-slot="markdown-content">富文本</div><PostActionsMenu {...props} copyContentId="rich-body" /></>);
  const payload = { text: "富文本", html: "<p>富文本</p>" };
  clipboard.payload.mockReturnValue(payload);
  clipboard.rich.mockResolvedValue(undefined);
  await user.click(screen.getByRole("button", { name: "楼层操作" }));
  await user.click(screen.getByRole("menuitem", { name: "复制内容" }));
  await waitFor(() => expect(clipboard.rich).toHaveBeenCalledWith(payload));
  expect(clipboard.payload).toHaveBeenCalledWith(document.getElementById("rich-body"));
  expect(clipboard.plain).toHaveBeenCalledTimes(2);
});
