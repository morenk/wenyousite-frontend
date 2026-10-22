import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TextFontDetail } from "../text-font-detail";
import { emptyTextFontConfiguration } from "@/lib/admin-text-font-form";
import type { AdminFontFamily } from "@/api/hooks/admin/use-admin-text-fonts";
const env = vi.hoisted(() => ({
  record: undefined as AdminFontFamily | undefined,
  preview: undefined as
    | { versionId: string; name: string; versionNumber: number; status: string }
    | undefined,
  authenticated: true,
  readFailed: false,
  previewFailed: false,
  refetch: vi.fn(),
  previewRefetch: vi.fn(),
  replace: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
  process: vi.fn(),
  publish: vi.fn(),
  enabled: vi.fn(),
  withdraw: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: env.replace }),
}));
vi.mock("@/api/hooks/use-admin", () => ({
  useAdminSession: () => ({
    sessionStatus: env.authenticated ? "authenticated" : "unavailable",
  }),
}));
vi.mock("@/api/hooks/admin/use-admin-text-fonts", () => ({
  useAdminTextFont: () => ({
    data: env.record,
    isError: env.readFailed,
    isFetching: false,
    refetch: env.refetch,
  }),
  useAdminTextFontPreview: () => ({
    data: env.preview,
    isError: env.previewFailed,
    refetch: env.previewRefetch,
  }),
  useAdminTextFontActions: () =>
    Object.fromEntries(
      [
        "create",
        "update",
        "upload",
        "process",
        "publish",
        "enabled",
        "withdraw",
      ].map((key) => [key, { mutateAsync: env[key as "create"] }]),
    ),
}));
vi.mock("@/components/editor/dynamic-font-specimen", () => ({
  DynamicFontSpecimen: ({ onReady }: { onReady: (ready: boolean) => void }) => (
    <button onClick={() => onReady(true)}>模拟样张加载成功</button>
  ),
}));
vi.mock("../text-font-withdraw-dialog", () => ({
  TextFontWithdrawDialog: () => <span>撤回确认</span>,
}));
const familyId = "tff_" + "a".repeat(32),
  versionId = "tfv_" + "b".repeat(32);
function record(): AdminFontFamily {
  return {
    ...emptyTextFontConfiguration,
    name: "原字体",
    familyId,
    revision: 7,
    catalogRevision: 10,
    enabled: true,
    currentVersionId: null,
    jobs: [],
    versionIds: [versionId],
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  env.authenticated = true;
  env.readFailed = false;
  env.previewFailed = false;
  env.record = undefined;
  env.preview = undefined;
  env.refetch.mockImplementation(async () => ({ data: env.record }));
  env.previewRefetch.mockResolvedValue({});
  env.create.mockResolvedValue({ familyId });
  env.update.mockResolvedValue({ revision: 8 });
});
afterEach(cleanup);
test("新建可缺授权但重复提交锁定；成功进入具体家族", async () => {
  let finish!: (value: unknown) => void;
  env.create.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<TextFontDetail />);
  expect(screen.getByRole("combobox", { name: "主要语言" })).toHaveTextContent("中文");
  fireEvent.change(screen.getByLabelText("字体名称"), {
    target: { value: "新字体" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存配置" }));
  await waitFor(() => expect(env.create).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: "正在保存…" })).toBeDisabled();
  expect(env.create.mock.calls[0]![0].designLanguage).toBe("zh");
  expect(env.create.mock.calls[0]![0].rights).toEqual({
    redistribution: false,
    conversion: false,
    subsetting: false,
  });
  finish({ familyId });
  await waitFor(() =>
    expect(env.replace).toHaveBeenCalledWith(`/station/text-fonts/${familyId}`),
  );
});
test("修订冲突保留编辑输入，读取最新状态后可重新提交", async () => {
  env.record = record();
  env.update.mockRejectedValueOnce({ code: 40928, message: "conflict" });
  render(<TextFontDetail familyId={familyId} />);
  fireEvent.change(screen.getByLabelText("字体名称"), {
    target: { value: "本地编辑" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存配置" }));
  await screen.findByRole("button", { name: "读取最新状态" });
  expect(screen.getByLabelText("字体名称")).toHaveValue("本地编辑");
  expect(screen.getByRole("button", { name: "保存配置" })).toBeDisabled();
  env.record = { ...record(), revision: 8, name: "服务端新名" };
  fireEvent.click(screen.getByRole("button", { name: "读取最新状态" }));
  await screen.findByRole("button", { name: "采用服务端配置" });
  expect(screen.getByLabelText("字体名称")).toHaveValue("本地编辑");
  fireEvent.click(screen.getByRole("button", { name: "采用服务端配置" }));
  expect(screen.getByLabelText("字体名称")).toHaveValue("服务端新名");
});
test("描述符成功不能代替实际样张；样张成功后才发布并带双修订", async () => {
  env.record = record();
  env.preview = {
    versionId,
    name: "字体",
    versionNumber: 1,
    status: "preview",
  };
  env.publish.mockResolvedValue({});
  render(<TextFontDetail familyId={familyId} />);
  expect(screen.getByRole("combobox", { name: "字体版本" })).toHaveTextContent(versionId.slice(-8));
  expect(screen.getByRole("combobox", { name: "字体版本" })).not.toHaveTextContent(versionId);
  expect(screen.getByRole("button", { name: "发布此版本" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "模拟样张加载成功" }));
  expect(screen.getByRole("button", { name: "发布此版本" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "发布此版本" }));
  await waitFor(() =>
    expect(env.publish).toHaveBeenCalledWith({
      familyId,
      versionId,
      expectedFamilyRevision: 7,
      expectedCatalogRevision: 10,
    }),
  );
});
test("会话复核失败保留表单并停用管理操作", () => {
  env.record = record();
  env.authenticated = false;
  render(<TextFontDetail familyId={familyId} />);
  expect(screen.getByLabelText("字体名称")).toHaveValue("原字体");
  expect(screen.getByLabelText("字体名称")).toBeDisabled();
  expect(screen.getByRole("button", { name: "保存配置" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "上传" })).toBeDisabled();
});
test("非法文件在上传前拒绝；服务器字段错误定位且保留内容", async () => {
  env.record = record();
  env.update.mockRejectedValue({ code: 40001, message: "name 太长" });
  render(<TextFontDetail familyId={familyId} />);
  fireEvent.change(screen.getByLabelText("TTF / OTF 文件"), {
    target: { files: [new File(["zip"], "font.zip")] },
  });
  fireEvent.click(screen.getByRole("button", { name: "上传" }));
  expect(await screen.findByText("仅支持单个 TTF 或 OTF 文件")).toBeVisible();
  expect(env.upload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "保存配置" }));
  await waitFor(() =>
    expect(screen.getByLabelText("字体名称")).toHaveAttribute(
      "aria-invalid",
      "true",
    ),
  );
  expect(screen.getByLabelText("字体名称")).toHaveValue("原字体");
});

test("新建空名称就近提示，不提交请求", async () => {
  render(<TextFontDetail />);
  fireEvent.click(screen.getByRole("button", { name: "保存配置" }));
  await waitFor(() => expect(screen.getByLabelText("字体名称")).toHaveAttribute("aria-invalid", "true"));
  expect(screen.getByText("请填写字体名称")).toBeVisible();
  expect(env.create).not.toHaveBeenCalled();
});
test("上传只显示上传等待；网关失败保留文件并允许核对状态", async () => {
  env.record = record();
  let fail!: (reason: unknown) => void;
  env.upload.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
  render(<TextFontDetail familyId={familyId} />);
  const file = new File(["font"], "font.ttf");
  fireEvent.change(screen.getByLabelText("TTF / OTF 文件"), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "上传" }));
  await screen.findByRole("button", { name: "正在上传…" });
  expect(screen.getByRole("button", { name: "保存配置" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "正在保存…" })).not.toBeInTheDocument();
  fail({ status: 504, message: "请求超时，操作结果尚未确认。请读取最新状态后重试。" });
  await screen.findByText(/请求超时/);
  expect((screen.getByLabelText("TTF / OTF 文件") as HTMLInputElement).files?.[0]).toBe(file);
  expect(screen.getByLabelText("字体名称")).toHaveValue("原字体");
  expect(screen.getByRole("button", { name: "上传" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "读取最新状态" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "上传" })).toBeEnabled());
});
test("处理提交有独立等待反馈；缺少授权定位材料和权利并保留草稿", async () => {
  env.record = { ...record(), jobs: [{ jobId: "job", sourceBytes: 4, status: "failed", failureCode: "rights-required" } as AdminFontFamily["jobs"][number]] };
  let fail!: (reason: unknown) => void;
  env.process.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
  render(<TextFontDetail familyId={familyId} />);
  fireEvent.click(screen.getByRole("button", { name: "重试处理" }));
  await screen.findByRole("button", { name: "提交处理中…" });
  expect(screen.getByRole("button", { name: "保存配置" })).toBeDisabled();
  fail({ code: 40929, message: "请补齐授权材料并确认字体使用权利" });
  await waitFor(() => expect(screen.getByLabelText("作者")).toHaveAttribute("aria-invalid", "true"));
  expect(screen.getByLabelText("完整授权材料")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("允许分发")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("字体名称")).toHaveValue("原字体");
  expect(screen.queryByRole("button", { name: "读取最新状态" })).not.toBeInTheDocument();
});
test("切换版本不能沿用上一版本样张就绪状态", async () => {
  const second = "tfv_" + "c".repeat(32);
  env.record = { ...record(), versionIds: [versionId, second], currentVersionId: versionId, jobs: [{ jobId: "job", sourceBytes: 4, status: "ready", versionId: second } as AdminFontFamily["jobs"][number]] };
  env.preview = { versionId, name: "字体", versionNumber: 1, status: "published" };
  const { rerender } = render(<TextFontDetail familyId={familyId} />);
  fireEvent.click(screen.getByRole("button", { name: "模拟样张加载成功" }));
  fireEvent.click(screen.getByRole("button", { name: "预览" }));
  expect(screen.getByRole("button", { name: "回滚为当前版本" })).toBeDisabled();
  env.preview = { versionId: second, name: "字体", versionNumber: 2, status: "preview" };
  rerender(<TextFontDetail familyId={familyId} />);
  expect(screen.getByRole("button", { name: "发布此版本" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "模拟样张加载成功" }));
  expect(screen.getByRole("button", { name: "发布此版本" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "预览" }));
  expect(screen.getByRole("button", { name: "发布此版本" })).toBeEnabled();
});

test("处理轮询失败保留任务和表单，手动读取成功后恢复操作", async () => {
  env.record = record();
  const { rerender } = render(<TextFontDetail familyId={familyId} />);
  fireEvent.change(screen.getByLabelText("字体名称"), { target: { value: "未保存名称" } });
  env.readFailed = true;
  rerender(<TextFontDetail familyId={familyId} />);
  expect(screen.getByLabelText("字体名称")).toHaveValue("未保存名称");
  expect(screen.getByRole("button", { name: "保存配置" })).toBeDisabled();
  env.readFailed = false;
  fireEvent.click(screen.getByRole("button", { name: "读取最新状态" }));
  rerender(<TextFontDetail familyId={familyId} />);
  await screen.findByRole("button", { name: "采用服务端配置" });
  expect(screen.getByLabelText("字体名称")).toHaveValue("未保存名称");
  await waitFor(() => expect(screen.getByRole("button", { name: "保存配置" })).toBeEnabled());
});

test("新建结果未知时先返回列表核对，不读取不存在的家族或重复创建", async () => {
  env.create.mockRejectedValue(new Error("连接中断，操作结果尚未确认"));
  render(<TextFontDetail />);
  fireEvent.change(screen.getByLabelText("字体名称"), { target: { value: "可能已创建" } });
  fireEvent.click(screen.getByRole("button", { name: "保存配置" }));
  await screen.findByText("操作结果尚未确认，请返回字体列表核对后再试。");
  expect(screen.getByRole("button", { name: "保存配置" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "读取最新状态" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "返回字体列表" })).toHaveAttribute("href", "/station/text-fonts");
  expect(env.create).toHaveBeenCalledTimes(1);
});

test("已有样张不能绕过预览读取错误，重试成功才恢复发布", async () => {
  env.record = record();
  env.preview = { versionId, name: "字体", versionNumber: 1, status: "preview" };
  const { rerender } = render(<TextFontDetail familyId={familyId} />);
  fireEvent.click(screen.getByRole("button", { name: "模拟样张加载成功" }));
  expect(screen.getByRole("button", { name: "发布此版本" })).toBeEnabled();
  env.previewFailed = true;
  rerender(<TextFontDetail familyId={familyId} />);
  expect(screen.getByRole("button", { name: "发布此版本" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  expect(env.previewRefetch).toHaveBeenCalledTimes(1);
  env.previewFailed = false;
  rerender(<TextFontDetail familyId={familyId} />);
  expect(screen.getByRole("button", { name: "发布此版本" })).toBeEnabled();
});
