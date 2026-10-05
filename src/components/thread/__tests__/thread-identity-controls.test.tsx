import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ThreadIdentityControls, type NewThreadIdentityDraft } from "../thread-identity-controls";
import { ThreadIdentitySettings } from "../thread-identity-settings";
import { collection, role } from "./rp-identity-fixtures";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const mocks = vi.hoisted(() => ({
  query: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  toggle: vi.fn(), confirm: vi.fn(), refetch: vi.fn(), error: vi.fn(),
}));
vi.mock("@/api/hooks/use-rp-identities", () => ({
  useRpIdentities: () => mocks.query(), useRpIdentity: () => mocks.detail(),
  useMutateRpIdentity: () => ({ create: { mutateAsync: mocks.create }, update: { mutateAsync: mocks.update }, remove: { mutateAsync: mocks.remove } }),
}));
vi.mock("@/api/hooks/use-thread-identity", () => ({ useSetThreadIdentityEnabled: () => ({ mutateAsync: mocks.toggle, isPending: false }) }));
vi.mock("@/components/ui/confirm-provider", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error } }));
vi.mock("@/components/user/avatar-uploader", async () => {
  const { SettingsDialog } = await import("@/components/user/settings-controls");
  return { AvatarUploader: ({ onSaveAvatar, onRemoveAvatar, onClose }: {
    onSaveAvatar: (id: string, uploaded: { url: string }) => Promise<unknown>; onRemoveAvatar: () => unknown; onClose: () => void;
  }) => <SettingsDialog title="测试头像" onClose={onClose}>
    <button onClick={() => void onSaveAvatar("media1", { url: "/new.webp" }).catch(mocks.error)}>保存测试头像</button>
    <button onClick={onRemoveAvatar}>删除测试头像</button><button onClick={onClose}>关闭头像</button>
  </SettingsDialog> };
});
function Harness({ id = "rp1", onClose = vi.fn(), onCreated = vi.fn(), initialDraft = { nickname: "" } }: {
  id?: string | null; onClose?: () => void; onCreated?: () => void; initialDraft?: NewThreadIdentityDraft;
}) {
  const [draft, setDraft] = useState(initialDraft);
  return <ThreadIdentityControls threadId="t1" identityId={id} draft={draft} onDraftChange={setDraft} onClose={onClose} onCreated={onCreated} />;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.query.mockReturnValue({ data: collection(), refetch: mocks.refetch });
  mocks.detail.mockReturnValue({ data: role(), refetch: mocks.refetch });
  mocks.refetch.mockResolvedValue({ data: collection(), isError: false });
  mocks.create.mockResolvedValue(role("rp2")); mocks.update.mockResolvedValue(role()); mocks.remove.mockResolvedValue(role("rp1", "", { deleted: true }));
  mocks.toggle.mockResolvedValue({}); mocks.confirm.mockResolvedValue(true);
});
afterEach(cleanup);
test("修改角色分别保存昵称和头像，始终携带稳定ID和打开时version", async () => {
  const created = vi.fn(); render(<Harness onCreated={created} />);
  await userEvent.click(screen.getByRole("button", { name: "修改帖内头像" }));
  await userEvent.click(screen.getByRole("button", { name: "保存测试头像" }));
  expect(mocks.update).toHaveBeenCalledWith({ identityId: "rp1", body: { avatarMediaId: "media1", version: 3 } });
  await userEvent.click(screen.getByRole("button", { name: "删除测试头像" }));
  expect(mocks.update).toHaveBeenCalledWith({ identityId: "rp1", body: { clearAvatar: true, version: 3 } });
  await userEvent.click(screen.getByRole("button", { name: "关闭头像" }));
  fireEvent.change(screen.getByLabelText("帖内昵称"), { target: { value: "夜渡" } });
  await userEvent.click(screen.getByRole("button", { name: "保存昵称" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ identityId: "rp1", body: { nickname: "夜渡", version: 3 } }));
  expect(created).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
});
test("空角色仍可删除，关闭功能后的删除携带version并释放名额", async () => {
  mocks.detail.mockReturnValue({ data: role("rp1", "", { display: null, identity: { id: "rp1", nickname: null, avatarMediaId: null, version: 3 }, canEdit: false }) });
  mocks.query.mockReturnValue({ data: collection([], { canEdit: false }), refetch: mocks.refetch });
  const close = vi.fn(); render(<Harness onClose={close} />);
  expect(screen.getByRole("button", { name: "保存昵称" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "删除帖内身份" }));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({ identityId: "rp1", version: 3 }));
  expect(close).toHaveBeenCalledOnce();
});
test("外部版本变化不覆盖正在编辑的基线，40002保留输入且不自动重试", async () => {
  const view = render(<Harness />);
  fireEvent.change(screen.getByLabelText("帖内昵称"), { target: { value: "草稿" } });
  mocks.detail.mockReturnValue({ data: role("rp1", "另端修改", { identity: { id: "rp1", nickname: "另端修改", avatarMediaId: null, version: 4 } }) });
  view.rerender(<Harness />);
  mocks.update.mockRejectedValue({ code: 40002, message: "资料已更新，请重新打开后编辑" });
  await userEvent.click(screen.getByRole("button", { name: "保存昵称" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("资料已更新");
  expect(screen.getByLabelText("帖内昵称")).toHaveValue("草稿");
  expect(mocks.update).toHaveBeenCalledTimes(1);
  expect(mocks.update).toHaveBeenCalledWith({ identityId: "rp1", body: { nickname: "草稿", version: 3 } });
});
test("加载错误可重试，资格撤销保留输入", async () => {
  mocks.detail.mockReturnValue({ isPending: true, refetch: mocks.refetch });
  const view = render(<Harness />);
  expect(screen.getByRole("status")).toHaveTextContent("加载");
  mocks.detail.mockReturnValue({ isError: true, refetch: mocks.refetch }); view.rerender(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: "身份加载失败，重试" }));
  expect(mocks.refetch).toHaveBeenCalled();
  mocks.detail.mockReturnValue({ data: role() }); view.rerender(<Harness />);
  fireEvent.change(screen.getByLabelText("帖内昵称"), { target: { value: "保留输入" } });
  mocks.detail.mockReturnValue({ data: role("rp1", "白鸦", { canEdit: false }) }); view.rerender(<Harness />);
  expect(screen.getByLabelText("帖内昵称")).toHaveValue("保留输入");
  expect(screen.getByRole("button", { name: "保存昵称" })).toBeDisabled();
});
test("新角色空输入不POST，创建成功明确回传新ID；40013只在表单报错", async () => {
  mocks.detail.mockReturnValue({}); const created = vi.fn(); const close = vi.fn();
  render(<Harness id={null} onCreated={created} onClose={close} />);
  await userEvent.click(screen.getByRole("button", { name: "创建身份" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("至少设置"); expect(mocks.create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("帖内昵称"), { target: { value: "白鸦" } });
  mocks.create.mockRejectedValueOnce({ code: 40013, message: "最多10个帖内身份" });
  await userEvent.click(screen.getByRole("button", { name: "创建身份" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("最多10");
  expect(screen.queryByText("创建结果待确认，查看身份列表")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "创建身份" }));
  await waitFor(() => expect(created).toHaveBeenCalledWith(expect.objectContaining({ identityId: "rp2" })));
  expect(close).toHaveBeenCalledOnce();
});
test("新建结果不明保留输入且不自动重发；GET失败不能确认列表", async () => {
  mocks.detail.mockReturnValue({}); mocks.create.mockRejectedValue(new TypeError("network"));
  const close = vi.fn(); const created = vi.fn(); render(<Harness id={null} onClose={close} onCreated={created} />);
  fireEvent.change(screen.getByLabelText("帖内昵称"), { target: { value: "白鸦" } });
  await userEvent.click(screen.getByRole("button", { name: "创建身份" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("创建结果未确认");
  expect(screen.getByLabelText("帖内昵称")).toHaveValue("白鸦");
  await userEvent.click(screen.getByRole("button", { name: "创建身份" }));
  expect(mocks.create).toHaveBeenCalledTimes(1); expect(created).not.toHaveBeenCalled();
  mocks.refetch.mockResolvedValueOnce({ isError: true });
  await userEvent.click(screen.getByRole("button", { name: "创建结果待确认，查看身份列表" }));
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("列表加载失败"))).toBe(true);
  expect(close).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "创建结果待确认，查看身份列表" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce()); expect(created).not.toHaveBeenCalled();
});
test("已核列表再次创建仍须明确确认，取消保留草稿不POST", async () => {
  mocks.detail.mockReturnValue({}); mocks.confirm.mockResolvedValueOnce(false);
  const close = vi.fn(); render(<Harness id={null} onClose={close} initialDraft={{ nickname: "同名角色", uncertain: true, reviewed: true }} />);
  await userEvent.click(screen.getByRole("button", { name: "创建身份" }));
  expect(mocks.create).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "创建身份" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ nickname: "同名角色", avatarMediaId: undefined }));
});
test("新建头像失败后保留上传引用和预览，改昵称不会重复上传", async () => {
  mocks.detail.mockReturnValue({}); mocks.create.mockRejectedValueOnce(new TypeError("network"));
  render(<Harness id={null} initialDraft={{ nickname: "头像角色" }} />);
  await userEvent.click(screen.getByRole("button", { name: "修改帖内头像" }));
  await userEvent.click(screen.getByRole("button", { name: "保存测试头像" }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalled());
  await userEvent.click(screen.getByRole("button", { name: "关闭头像" }));
  expect(screen.getByRole("img", { name: "头像角色" })).toHaveAttribute("src", "/new.webp");
  expect(screen.getByLabelText("帖内昵称")).toHaveValue("头像角色");
  expect(mocks.create).toHaveBeenCalledWith({ nickname: "头像角色", avatarMediaId: "media1" });
});
test("启用立即写入，关闭须确认，取消和失败保留原状态", async () => {
  const view = render(<ThreadIdentitySettings threadId="t1" enabled={false} />);
  expect(screen.getByText("未开启")).toBeInTheDocument();
  expect(screen.queryByText(/楼主、协作者和玩家可设置/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "启用帖内身份" }));
  expect(mocks.toggle).toHaveBeenCalledWith(true);
  expect(mocks.confirm).not.toHaveBeenCalled();
  view.rerender(<ThreadIdentitySettings threadId="t1" enabled />);
  mocks.confirm.mockResolvedValueOnce(false);
  await userEvent.click(screen.getByRole("button", { name: "关闭帖内身份" }));
  expect(mocks.toggle).toHaveBeenCalledTimes(1);
  mocks.toggle.mockRejectedValueOnce(new Error("离线"));
  await userEvent.click(screen.getByRole("button", { name: "关闭帖内身份" }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("离线"));
  expect(screen.getByRole("button", { name: "关闭帖内身份" })).toHaveAttribute("aria-pressed", "true");
  view.rerender(<ThreadIdentitySettings threadId="t1" enabled disabled />);
  expect(screen.getByRole("button", { name: "关闭帖内身份" })).toBeDisabled();
});
