import { beforeEach, expect, test, vi } from "vitest";
import { continueFontSubmission, newFontSubmissionRecovery, readFontRecovery, saveFontRecovery } from "../admin-font-submission";
import type { FontSubmission } from "@/api/hooks/admin/use-admin-font-submission";

const id = "f48fc025-1ff4-48b5-b6c2-fc9ae6517f79";
const create = { submissionId: id, name: "新字体", language: "other" as const, familyId: "tff_" + "a".repeat(32), expectedFamilyRevision: 7 };
const blank: FontSubmission = { submissionId: id, familyId: create.familyId, familyRevision: 8, name: create.name, language: "other", sortOrder: 0, authorizationRuleVersion: "admin-font-upload-v1", job: null, createdAt: "", updatedAt: "" };
const job = { jobId: "tfj_" + "b".repeat(32), familyId: create.familyId, status: "draft" as const, sourceSha256: "a".repeat(64), sourceBytes: 4, versionId: null, failureCode: null };
const draft = { ...blank, job };
const queued = { ...blank, job: { ...job, status: "queued" as const } };
const file = new File(["font"], "字体.ttf");
function setup() {
  return { recovery: newFontSubmissionRecovery(create), api: { read: vi.fn().mockResolvedValue(queued), create: vi.fn().mockResolvedValue(blank), upload: vi.fn().mockResolvedValue(job), process: vi.fn().mockResolvedValue(job) }, persist: vi.fn(), progress: vi.fn() };
}
beforeEach(() => sessionStorage.clear());
test("创建响应丢失先查询同一提交，不重复创建；上传、处理按顺序且无发布调用", async () => {
  const env = setup(); env.api.read.mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce(blank).mockResolvedValueOnce(draft).mockResolvedValueOnce(queued);
  env.api.create.mockRejectedValueOnce(new TypeError("lost"));
  expect(await continueFontSubmission({ ...env, file })).toEqual(queued);
  expect(env.api.create).toHaveBeenCalledExactlyOnceWith(create);
  expect(env.api.upload).toHaveBeenCalledTimes(1);
  expect(env.api.process).toHaveBeenCalledExactlyOnceWith(id, env.recovery.firstProcessRequestId);
  expect(env.persist.mock.invocationCallOrder[0]).toBeLessThan(env.api.upload.mock.invocationCallOrder[0]!);
});
test("刷新后查询不存在才使用首次原修订重放，文件不可持久化且要求重选", async () => {
  const env = setup(); saveFontRecovery("test", env.recovery);
  const restored = readFontRecovery("test")!;
  env.api.read.mockRejectedValueOnce({ status: 404 });
  await expect(continueFontSubmission({ ...env, recovery: restored })).rejects.toThrow("重新选择原字体文件");
  expect(env.api.create).toHaveBeenCalledExactlyOnceWith(create);
  expect(env.api.upload).not.toHaveBeenCalled();
  expect(JSON.parse(sessionStorage.getItem("test")!)).toEqual(env.recovery);
});
test("恢复查询失败不创建、不上传、不处理", async () => {
  const env = setup(); env.api.read.mockRejectedValue({ status: 503 });
  await expect(continueFontSubmission({ ...env, file })).rejects.toEqual({ status: 503 });
  expect(env.api.create).not.toHaveBeenCalled(); expect(env.api.upload).not.toHaveBeenCalled(); expect(env.api.process).not.toHaveBeenCalled();
});
test("上传结果未知先GET，已绑定job跳过文件重传", async () => {
  const env = setup(); env.api.read.mockResolvedValueOnce(blank).mockResolvedValueOnce(draft).mockResolvedValueOnce(draft);
  env.api.upload.mockRejectedValue(new TypeError("lost"));
  await continueFontSubmission({ ...env, file });
  expect(env.api.upload).toHaveBeenCalledTimes(1); expect(env.api.process).toHaveBeenCalledTimes(1);
});
test("上传结果未知且尚未绑定只保留恢复键，不自动重发", async () => {
  const env = setup(); env.api.read.mockResolvedValue(blank); env.api.upload.mockRejectedValue(new TypeError("lost"));
  await expect(continueFontSubmission({ ...env, file })).rejects.toThrow("lost");
  expect(env.api.upload).toHaveBeenCalledTimes(1); expect(env.api.process).not.toHaveBeenCalled();
  expect(env.persist.mock.calls[0]![0]).toMatchObject({ create, firstProcessRequestId: env.recovery.firstProcessRequestId, sourceSha256: expect.any(String) });
});
test("恢复已有draft无需文件；处理响应丢失只查询并保留同一个请求键", async () => {
  const env = setup(); env.api.read.mockResolvedValueOnce(draft); env.api.process.mockRejectedValue(new TypeError("lost"));
  expect(await continueFontSubmission(env)).toEqual(queued);
  expect(env.api.upload).not.toHaveBeenCalled(); expect(env.api.process).toHaveBeenCalledExactlyOnceWith(id, env.recovery.processRequestId);
});
test("失败任务恢复不自动重试，明确重试换处理键并保留首次键、提交与源", async () => {
  const env = setup(); const failed = { ...blank, job: { ...job, status: "failed" as const } }; env.api.read.mockResolvedValue(failed);
  await continueFontSubmission(env); expect(env.api.process).not.toHaveBeenCalled();
  await continueFontSubmission({ ...env, retryFailed: true });
  const next = env.persist.mock.calls[0]![0];
  expect(next.create).toEqual(create); expect(next.firstProcessRequestId).toBe(env.recovery.firstProcessRequestId);
  expect(next.processRequestId).not.toBe(env.recovery.processRequestId);
  expect(env.api.process).toHaveBeenCalledExactlyOnceWith(id, next.processRequestId); expect(env.api.upload).not.toHaveBeenCalled();
});
test("刷新后拒绝不同文件内容与损坏恢复数据", async () => {
  const env = setup(); env.api.read.mockResolvedValue(blank);
  await expect(continueFontSubmission({ ...env, file, recovery: { ...env.recovery, sourceSha256: "0".repeat(64) } })).rejects.toThrow("文件内容不一致");
  expect(env.api.upload).not.toHaveBeenCalled(); sessionStorage.setItem("bad", '{"create":{}}'); expect(readFontRecovery("bad")).toBeUndefined();
});

test("仅明确创建拒绝且GET确认不存在才允许修正请求；未知结果保留原键", async () => {
  const env = setup(); env.api.read.mockRejectedValue({ status: 404 }); env.api.create.mockRejectedValue({ status: 400, code: 40001, message: "name 太长" });
  const { FontSubmissionCreateRejected } = await import("../admin-font-submission");
  await expect(continueFontSubmission({ ...env, file })).rejects.toBeInstanceOf(FontSubmissionCreateRejected);
  env.api.create.mockRejectedValue(new TypeError("lost"));
  await expect(continueFontSubmission({ ...env, file })).rejects.toBeInstanceOf(TypeError);
});
test("会话存储不可写时明确阻止无法恢复的提交", () => {
  const set = vi.spyOn(sessionStorage, "setItem").mockImplementationOnce(() => { throw new Error("quota"); });
  expect(() => saveFontRecovery("key", setup().recovery)).toThrow("无法保存上传恢复信息"); set.mockRestore();
});

test("明确幂等键冲突即使查询到已有提交也不继续上传或处理", async () => {
  const env = setup(); env.api.read.mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce(blank);
  env.api.create.mockRejectedValue({ status: 409, code: 40930, message: "提交键冲突" });
  await expect(continueFontSubmission({ ...env, file })).rejects.toMatchObject({ code: 40930 });
  expect(env.api.upload).not.toHaveBeenCalled(); expect(env.api.process).not.toHaveBeenCalled();
});
test("源绑定明确冲突不被未知结果恢复吞掉，已有job也不自动处理", async () => {
  const env = setup(); env.api.read.mockResolvedValueOnce(blank).mockResolvedValueOnce(draft);
  env.api.upload.mockRejectedValue({ status: 409, code: 40930, message: "源文件冲突" });
  await expect(continueFontSubmission({ ...env, file })).rejects.toMatchObject({ code: 40930 });
  expect(env.api.process).not.toHaveBeenCalled();
});
test("持久化源摘要与绑定任务不同则拒绝继续", async () => {
  const env = setup(); env.api.read.mockResolvedValue(draft);
  await expect(continueFontSubmission({ ...env, recovery: { ...env.recovery, sourceSha256: "b".repeat(64) } })).rejects.toThrow("文件摘要不一致");
  expect(env.api.process).not.toHaveBeenCalled();
});
