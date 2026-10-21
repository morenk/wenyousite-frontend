import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TextFontWithdrawDialog } from "../text-font-withdraw-dialog";
const env = vi.hoisted(() => ({
  withdraw: vi.fn(),
  authenticated: true,
  elevated: true,
}));
vi.mock("@/api/hooks/admin/use-admin-text-fonts", () => ({
  useAdminTextFontActions: () => ({ withdraw: { mutateAsync: env.withdraw } }),
}));
vi.mock("@/api/hooks/use-admin", () => ({
  useAdminSession: () => ({
    sessionStatus: env.authenticated ? "authenticated" : "unavailable",
  }),
}));
vi.mock("../high-risk-gate", () => ({
  HighRiskGate: ({ children }: { children: React.ReactNode }) =>
    env.elevated ? children : <span>邮箱提权</span>,
}));
beforeEach(() => {
  env.withdraw.mockReset();
  env.authenticated = true;
  env.elevated = true;
});
afterEach(cleanup);
test("未提权不展示撤回表单；会话暂时不可用不提交", () => {
  env.elevated = false;
  const view = render(
    <TextFontWithdrawDialog
      versionId="version"
      revision={4}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByText("邮箱提权")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "确认撤回" }),
  ).not.toBeInTheDocument();
  env.elevated = true;
  env.authenticated = false;
  view.rerender(
    <TextFontWithdrawDialog
      versionId="version"
      revision={4}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "确认撤回" })).toBeDisabled();
});
test("撤回保留失败理由、限制重复请求且成功才关闭", async () => {
  const close = vi.fn();
  let reject!: (error: unknown) => void;
  env.withdraw
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValue({});
  render(
    <TextFontWithdrawDialog versionId="version" revision={4} onClose={close} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "确认撤回" }));
  expect(await screen.findByText("请填写撤回理由")).toBeVisible();
  expect(env.withdraw).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("撤回理由"), {
    target: { value: "授权需要撤回" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认撤回" }));
  await waitFor(() => expect(env.withdraw).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: "正在撤回…" })).toBeDisabled();
  reject({ code: 40928, message: "状态已变化" });
  await screen.findByText("状态已变化");
  expect(screen.getByLabelText("撤回理由")).toHaveValue("授权需要撤回");
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "确认撤回" }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(env.withdraw).toHaveBeenLastCalledWith({
    versionId: "version",
    expectedCatalogRevision: 4,
    reason: "授权需要撤回",
  });
});
