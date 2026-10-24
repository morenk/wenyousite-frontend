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
  continueJob: vi.fn(),
  publish: vi.fn(),
  enabled: vi.fn(),
  withdraw: vi.fn(),
}));
vi.mock("@/api/hooks/admin/use-admin-font-submission", () => ({ useContinueAdminFontJob: () => ({ mutateAsync: env.continueJob }) }));
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
vi.mock("../text-font-upload-panel", () => ({
  TextFontUploadPanel: ({ disabled, onReady }: { disabled?: boolean; onReady?: (value: object) => void }) => <><button disabled={disabled}>上传并处理</button><button onClick={() => onReady?.({ job: { versionId: "tfv_" + "b".repeat(32) } })}>模拟处理完成</button></>,
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
test("新建入口使用上传并处理表单", () => {
  render(<TextFontDetail />);
  expect(screen.getByRole("button", { name: "上传并处理" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "保存配置" })).not.toBeInTheDocument();
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
  expect(screen.getByRole("button", { name: "上传并处理" })).toBeDisabled();
});
test("服务器配置字段错误定位且保留内容", async () => {
  env.record = record();
  env.update.mockRejectedValue({ code: 40001, message: "name 太长" });
  render(<TextFontDetail familyId={familyId} />);
  fireEvent.click(screen.getByRole("button", { name: "保存配置" }));
  await waitFor(() =>
    expect(screen.getByLabelText("字体名称")).toHaveAttribute(
      "aria-invalid",
      "true",
    ),
  );
  expect(screen.getByLabelText("字体名称")).toHaveValue("原字体");
});

test("历史任务处理等待锁定管理；旧授权不足引导新版上传且保留草稿", async () => {
  env.record = { ...record(), jobs: [{ jobId: "job", sourceBytes: 4, status: "failed", failureCode: "rights-required" } as AdminFontFamily["jobs"][number]] };
  let fail!: (reason: unknown) => void;
  env.process.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
  render(<TextFontDetail familyId={familyId} />);
  fireEvent.click(screen.getByRole("button", { name: "重试处理" }));
  await screen.findByRole("button", { name: "提交处理中…" });
  expect(screen.getByRole("button", { name: "保存配置" })).toBeDisabled();
  fail({ code: 40929, message: "请补齐授权材料并确认字体使用权利" });
  await screen.findByText("此历史任务缺少授权材料，请通过上传新版重新提交并确认字体使用权利。");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
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

test("更多信息默认折叠，补充信息和样张可留空且无排序或权利输入", async () => {
  env.record = record();
  render(<TextFontDetail familyId={familyId} />);
  expect(screen.queryByLabelText("作者")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "更多信息" }));
  fireEvent.change(await screen.findByLabelText("样张文字"), { target: { value: "" } });
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "保存配置" }));
  await waitFor(() => expect(env.update).toHaveBeenCalledWith(expect.objectContaining({ author: "", licenseName: "", specimenText: "温油站，一起书写故事。0123456789", expectedFamilyRevision: 7 })));
});

test("新流程历史任务按submissionId恢复，旧任务仍使用旧处理API", async () => {
  const submissionId = "f48fc025-1ff4-48b5-b6c2-fc9ae6517f79";
  env.record = { ...record(), jobs: [{ jobId: "new-job", familyId, sourceBytes: 4, status: "draft", sourceSha256: "a".repeat(64), versionId: null, failureCode: null, submissionId } as AdminFontFamily["jobs"][number]] };
  env.continueJob.mockResolvedValue({});
  render(<TextFontDetail familyId={familyId} />);
  fireEvent.click(screen.getByRole("button", { name: "开始处理" }));
  await waitFor(() => expect(env.continueJob).toHaveBeenCalledExactlyOnceWith({ submissionId, jobId: "new-job", familyId, retryFailed: false }));
  expect(env.process).not.toHaveBeenCalled();
});

test.each([["embedding-restricted", "字体禁止嵌入"], ["subsetting-restricted", "字体禁止分片"], ["bitmap-only", "字体仅允许位图嵌入"]] as const)("直接进入详情仍显示字体限制原因%s", (failureReason, message) => {
  env.record = { ...record(), jobs: [{ jobId: "restricted", familyId, sourceBytes: 4, status: "failed", sourceSha256: "a".repeat(64), versionId: null, failureCode: "rights-required", failureReason, submissionId: null }] };
  render(<TextFontDetail familyId={familyId} />);
  expect(screen.getByRole("cell", { name: message })).toBeVisible();
  expect(screen.queryByText("授权材料或权限不完整")).not.toBeInTheDocument();
});

test("处理完成的后台刷新不把并发配置修订悄悄用于覆盖本地编辑", async () => {
  env.record = record(); const view = render(<TextFontDetail familyId={familyId} />);
  fireEvent.change(screen.getByLabelText("字体名称"), { target: { value: "本地未保存" } });
  env.record = { ...record(), name: "他人已保存", revision: 9 };
  view.rerender(<TextFontDetail familyId={familyId} />);
  fireEvent.click(screen.getByRole("button", { name: "模拟处理完成" }));
  await screen.findByRole("button", { name: "采用服务端配置" });
  expect(screen.getByLabelText("字体名称")).toHaveValue("本地未保存");
  expect(screen.getByRole("button", { name: "保存配置" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "采用服务端配置" }));
  expect(screen.getByLabelText("字体名称")).toHaveValue("他人已保存");
  expect(screen.getByRole("button", { name: "保存配置" })).toBeEnabled();
});

test("保存资料沿用最新隐藏排序与旧授权值，不覆盖并发排序", async () => {
  env.record = { ...record(), sortOrder: 10 };
  const view = render(<TextFontDetail familyId={familyId} />);
  fireEvent.change(screen.getByLabelText("字体名称"), { target: { value: "本地名称" } });
  const rights = { redistribution: true, conversion: true, subsetting: true };
  env.record = { ...record(), sortOrder: 0, rights, revision: 8 };
  view.rerender(<TextFontDetail familyId={familyId} />);
  fireEvent.click(screen.getByRole("button", { name: "模拟处理完成" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "保存配置" })).toBeEnabled());
  expect(screen.getByLabelText("字体名称")).toHaveValue("本地名称");
  fireEvent.click(screen.getByRole("button", { name: "保存配置" }));
  await waitFor(() => expect(env.update).toHaveBeenCalledWith(expect.objectContaining({ name: "本地名称", sortOrder: 0, rights, expectedFamilyRevision: 8 })));
});


test("明确点击已选任务预览仍定位样张，后台处理完成不抢滚动", async () => {
  env.record = { ...record(), jobs: [{ jobId: "job", sourceBytes: 4, status: "ready", versionId } as AdminFontFamily["jobs"][number]] };
  env.preview = { versionId, name: "字体", versionNumber: 1, status: "preview" };
  render(<TextFontDetail familyId={familyId} />);
  const section = screen.getByRole("heading", { name: "版本与发布" }).closest("section")!;
  const scroll = vi.fn();
  section.scrollIntoView = scroll;
  fireEvent.click(screen.getByRole("button", { name: "预览" }));
  expect(scroll).toHaveBeenCalledWith({ block: "start" });
  expect(screen.getByRole("button", { name: "发布此版本" })).toBeDisabled();
  scroll.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "模拟处理完成" }));
  await waitFor(() => expect(env.refetch).toHaveBeenCalled());
  expect(scroll).not.toHaveBeenCalled();
});
