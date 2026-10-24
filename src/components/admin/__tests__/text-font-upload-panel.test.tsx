import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TextFontUploadPanel } from "../text-font-upload-panel";
import { newFontSubmissionRecovery, saveFontRecovery } from "@/lib/admin-font-submission";
import type { FontSubmission } from "@/api/hooks/admin/use-admin-font-submission";
const env = vi.hoisted(() => ({ data: undefined as FontSubmission | undefined, sessionStatus: "authenticated", previewError: false, previewLoading: false, preview: vi.fn(), previewRefetch: vi.fn(), read: vi.fn(), create: vi.fn(), upload: vi.fn(), process: vi.fn(), refresh: vi.fn() }));
vi.mock("@/api/hooks/use-admin", () => ({ useAdminSession: () => ({ data: { user: { id: "test-admin" } }, sessionStatus: env.sessionStatus }) }));
vi.mock("@/api/hooks/admin/use-admin-font-submission", () => ({
  fontSubmissionApi: { read: env.read, create: env.create, upload: env.upload, process: env.process },
  useAdminFontSubmission: () => ({ data: env.data, isLoading: false, isError: false, refetch: env.read }),
  useRefreshAdminFonts: () => env.refresh,
}));
vi.mock("@/api/hooks/admin/use-admin-text-fonts", () => ({ useAdminTextFontPreview: (id: string) => { env.preview(id); return { data: env.previewLoading ? undefined : { versionId: id }, isError: env.previewError, isFetching: false, refetch: env.previewRefetch }; } }));
vi.mock("@/components/editor/dynamic-font-specimen", () => ({ DynamicFontSpecimen: ({ versionId }: { versionId: string }) => <span role="img" aria-label="字体样张" data-version={versionId} /> }));
const id = "f48fc025-1ff4-48b5-b6c2-fc9ae6517f79", familyId = "tff_" + "a".repeat(32), versionId = "tfv_" + "b".repeat(32);
const blank: FontSubmission = { submissionId: id, familyId, familyRevision: 8, name: "字体", language: "other", sortOrder: 0, authorizationRuleVersion: "admin-font-upload-v1", job: null, createdAt: "", updatedAt: "" };
const draft: FontSubmission = { ...blank, job: { jobId: "tfj_" + "c".repeat(32), familyId, status: "draft", sourceSha256: "a".repeat(64), sourceBytes: 4, versionId: null, failureCode: null } };
const ready: FontSubmission = { ...draft, job: { ...draft.job!, status: "ready", versionId } };
const storageKey = "admin-font-submission:test-admin:new";
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); env.data = undefined; env.sessionStatus = "authenticated"; env.previewError = false; env.previewLoading = false; env.create.mockResolvedValue(blank); env.upload.mockResolvedValue(draft.job); env.process.mockResolvedValue(ready.job); env.refresh.mockResolvedValue(undefined); });
afterEach(cleanup);
const select = () => { const file = new File(["font"], "新字体.ttf"); fireEvent.change(screen.getByLabelText("字体文件"), { target: { files: [file] } }); return file; };
test("一次按钮编排创建上传处理，重复点击锁定；就绪仅提供手动预览发布入口", async () => {
  let finish!: (value: FontSubmission) => void;
  env.read.mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce(draft).mockResolvedValueOnce(ready);
  env.create.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  render(<TextFontUploadPanel />); const file = select();
  const button = screen.getByRole("button", { name: "上传并处理" }); fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(env.create).toHaveBeenCalledTimes(1)); expect(button).toBeDisabled();
  const first = JSON.parse(sessionStorage.getItem(storageKey)!);
  expect(first.create).toEqual({ submissionId: expect.any(String), name: "新字体", language: "other" });
  await act(async () => finish(blank));
  await screen.findByRole("link", { name: "预览并发布" });
  expect(env.upload).toHaveBeenCalledWith(blank, file, expect.any(Function)); expect(env.process).toHaveBeenCalledExactlyOnceWith(id, first.firstProcessRequestId);
  expect(screen.getByRole("img", { name: "字体样张" })).toHaveAttribute("data-version", versionId);
  expect(screen.queryByRole("button", { name: "发布此版本" })).not.toBeInTheDocument();
});
test("刷新恢复未上传提交只要求重新选择文件，保留首次请求与原修订", async () => {
  const recovery = newFontSubmissionRecovery({ submissionId: id, name: "原名称", language: "ja", familyId, expectedFamilyRevision: 7 }); saveFontRecovery(storageKey, recovery);
  env.data = blank; render(<TextFontUploadPanel />);
  fireEvent.click(screen.getByRole("button", { name: "上传并处理" }));
  await screen.findByText("请选择字体文件"); expect(env.create).not.toHaveBeenCalled(); expect(env.upload).not.toHaveBeenCalled();
  expect(JSON.parse(sessionStorage.getItem(storageKey)!)).toEqual(recovery);
});
test("恢复已上传任务无需文件直接继续，处理失败明确重试才换键", async () => {
  const recovery = newFontSubmissionRecovery({ submissionId: id, name: "字体", language: "other" }); saveFontRecovery(storageKey, recovery);
  env.data = { ...draft, job: { ...draft.job!, status: "failed", failureCode: "sandbox-unavailable" } }; env.read.mockResolvedValueOnce(env.data).mockResolvedValueOnce(ready);
  render(<TextFontUploadPanel />); expect(screen.queryByLabelText("字体文件")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("处理环境暂不可用，可使用已上传文件重试。");
  expect(env.process).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "重试处理" }));
  await waitFor(() => expect(env.process).toHaveBeenCalledTimes(1)); expect(env.upload).not.toHaveBeenCalled();
  expect(env.process.mock.calls[0]![1]).not.toBe(recovery.processRequestId);
  expect(JSON.parse(sessionStorage.getItem(storageKey)!).firstProcessRequestId).toBe(recovery.firstProcessRequestId);
});

test.each([
  ["invalid-font", "字体文件无效"],
  ["unsupported-font", "不支持此字体格式"],
  ["rights-required", "授权材料或权限不完整"],
  ["resource-limit", "超出处理资源限制"],
  ["sandbox-unavailable", "处理环境暂不可用"],
  ["processing-failed", "字体处理失败"],
] as const)("失败上传显示固定安全类别%s，不自动重试", (failureCode, message) => {
  env.data = { ...draft, job: { ...draft.job!, status: "failed", failureCode } };
  render(<TextFontUploadPanel submissionId={id} />);
  expect(screen.getByRole("alert")).toHaveTextContent(`${message}，可使用已上传文件重试。`);
  expect(screen.getByRole("button", { name: "重试处理" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "上传另一个文件" })).toBeEnabled();
  expect(env.process).not.toHaveBeenCalled();
  expect(env.upload).not.toHaveBeenCalled();
});

test.each([["embedding-restricted", "字体禁止嵌入"], ["subsetting-restricted", "字体禁止分片"], ["bitmap-only", "字体仅允许位图嵌入"]] as const)("字体权限限制%s优先于通用失败类别且不重复提示", (failureReason, message) => {
  env.data = { ...draft, job: { ...draft.job!, status: "failed", failureCode: "rights-required", failureReason } };
  render(<TextFontUploadPanel submissionId={id} />);
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByRole("alert")).toHaveTextContent(`${message}，可使用已上传文件重试。`);
  expect(screen.queryByText(/授权材料或权限不完整/)).not.toBeInTheDocument();
});

test.each([null, "worker error at /private/font/source.ttf", "__proto__", "toString"])("缺失或未识别的失败类别%s使用安全兜底，不回显诊断内容", (failureCode) => {
  env.data = { ...draft, job: { ...draft.job!, status: "failed", failureCode, failureReason: "unknown internal reason" } } as unknown as FontSubmission;
  render(<TextFontUploadPanel submissionId={id} />);
  expect(screen.getByRole("alert")).toHaveTextContent("处理失败，可使用已上传文件重试。");
  expect(screen.queryByText(/private\/font|unknown internal reason|__proto__|toString/)).not.toBeInTheDocument();
});
test("上传超时保留所选文件和恢复键；再次点击先GET不再创建", async () => {
  env.read.mockRejectedValueOnce({ status: 404 }).mockResolvedValue(blank); env.upload.mockRejectedValue(new TypeError("超时，结果尚未确认"));
  render(<TextFontUploadPanel />); const file = select(); fireEvent.click(screen.getByRole("button", { name: "上传并处理" }));
  await screen.findByText("超时，结果尚未确认");
  expect((screen.getByLabelText("字体文件") as HTMLInputElement).files?.[0]).toBe(file);
  const saved = sessionStorage.getItem(storageKey); fireEvent.click(screen.getByRole("button", { name: "上传并处理" }));
  await waitFor(() => expect(env.upload).toHaveBeenCalledTimes(2)); expect(env.create).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem(storageKey)).toBe(saved);
});

test("会话暂时复核失败保留已选文件并停用提交，复核恢复后可继续", () => {
  const view = render(<TextFontUploadPanel />); const file = select();
  env.sessionStatus = "unavailable"; view.rerender(<TextFontUploadPanel />);
  expect((screen.getByLabelText("字体文件") as HTMLInputElement).files?.[0]).toBe(file);
  expect(screen.getByRole("button", { name: "上传并处理" })).toBeDisabled();
  env.sessionStatus = "authenticated"; view.rerender(<TextFontUploadPanel />);
  expect(screen.getByRole("button", { name: "上传并处理" })).toBeEnabled();
});


test("新建就绪显示对应真实样张入口，读取失败可重试；已有家族不重复渲染", async () => {
  env.data = ready; env.previewLoading = true;
  const view = render(<TextFontUploadPanel />);
  expect(env.preview).toHaveBeenCalledWith(versionId);
  expect(screen.getByText("正在读取样张…")).toBeVisible();
  env.previewError = true; view.rerender(<TextFontUploadPanel />);
  expect(screen.getByRole("alert")).toHaveTextContent("样张读取失败");
  fireEvent.click(screen.getByRole("button", { name: "重试样张" }));
  expect(env.previewRefetch).toHaveBeenCalledOnce();
  env.previewError = false; env.previewLoading = false; view.rerender(<TextFontUploadPanel />);
  expect(screen.getByRole("img", { name: "字体样张" })).toHaveAttribute("data-version", versionId);
  env.preview.mockClear();
  view.rerender(<TextFontUploadPanel existing={{ familyId, name: "字体", language: "other", revision: 8 }} />);
  expect(screen.queryByRole("img", { name: "字体样张" })).not.toBeInTheDocument();
  expect(env.preview).not.toHaveBeenCalled();
});
