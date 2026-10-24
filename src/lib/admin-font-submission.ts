import { z } from "zod";
import type { components } from "@/api/types";
type CreateFontSubmission = components["schemas"]["CreateFontSubmissionDto"];
type FontSubmission = components["schemas"]["FontSubmissionDto"];
import type { UploadBytes } from "@/api/upload-progress";
import { getApiError } from "@/api/errors";

const recoverySchema = z.object({
  create: z.object({ submissionId: z.uuid(), name: z.string().min(1).max(160), language: z.enum(["zh", "ja", "en", "other"]), familyId: z.string().regex(/^tff_[a-f0-9]{32}$/).optional(), expectedFamilyRevision: z.number().int().positive().optional() }).optional(),
  submissionId: z.uuid().optional(),
  firstProcessRequestId: z.uuid(), processRequestId: z.uuid(),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).refine((value) => Boolean(value.create || value.submissionId));
export type FontSubmissionRecovery = z.infer<typeof recoverySchema>;
export function newFontSubmissionRecovery(create: CreateFontSubmission): FontSubmissionRecovery {
  const requestId = crypto.randomUUID();
  return { create, firstProcessRequestId: requestId, processRequestId: requestId };
}
export function fontRecoveryId(value: FontSubmissionRecovery): string {
  return value.create?.submissionId ?? value.submissionId!;
}
export function resumeFontSubmissionRecovery(submissionId: string): FontSubmissionRecovery {
  const requestId = crypto.randomUUID();
  return { submissionId, firstProcessRequestId: requestId, processRequestId: requestId };
}
export function readFontRecovery(key: string): FontSubmissionRecovery | undefined {
  try { return recoverySchema.parse(JSON.parse(sessionStorage.getItem(key) ?? "null")); } catch { return undefined; }
}
export function saveFontRecovery(key: string, value: FontSubmissionRecovery) {
  // 写入失败必须在请求前停止，否则刷新后将无法安全恢复未知结果。
  try { sessionStorage.setItem(key, JSON.stringify(recoverySchema.parse(value))); }
  catch { throw new Error("无法保存上传恢复信息，请允许此站点使用会话存储后重试。"); }
}
export type FontSubmissionProgress = { phase: "creating" | "checking" | "processing" } | ({ phase: "uploading" } & UploadBytes);
export class FontSubmissionCreateRejected extends Error {
  readonly code?: number;
  readonly status?: number;
  constructor(reason: unknown) {
    const info = getApiError(reason);
    super(info.message ?? "提交未创建，请修正输入后重试"); this.code = info.code; this.status = info.status;
  }
}
export interface FontSubmissionOperations {
  read: (id: string) => Promise<FontSubmission>;
  create?: (body: CreateFontSubmission) => Promise<FontSubmission>;
  upload?: (submission: FontSubmission, file: File, progress: (bytes: UploadBytes) => void) => Promise<unknown>;
  process: (id: string, requestId: string) => Promise<unknown>;
}
function unknownWriteResult(error: unknown) {
  const { status, code } = getApiError(error);
  return status === 408 || (status !== undefined && status >= 500)
    || (status === undefined && (code === undefined || code >= 50000));
}
/** 每次继续都先 GET；首次请求与修订不可随重试改写。网络错误不自动重发写入。 */
export async function continueFontSubmission({ recovery, file, retryFailed = false, api, persist, progress }: {
  recovery: FontSubmissionRecovery; file?: File; retryFailed?: boolean; api: FontSubmissionOperations;
  persist: (value: FontSubmissionRecovery) => void; progress: (value: FontSubmissionProgress) => void;
}): Promise<FontSubmission> {
  const submissionId = fontRecoveryId(recovery);
  progress({ phase: "checking" });
  let submission: FontSubmission;
  try { submission = await api.read(submissionId); }
  catch (error) {
    if (getApiError(error).status !== 404 || !recovery.create || !api.create) throw error;
    progress({ phase: "creating" });
    try { submission = await api.create(recovery.create); }
    catch (createError) {
      try { submission = await api.read(submissionId); }
      catch (readError) {
        const status = getApiError(createError).status;
        if (status && [400, 403, 409, 422].includes(status) && getApiError(readError).status === 404)
          throw new FontSubmissionCreateRejected(createError);
        throw createError;
      }
      if (!unknownWriteResult(createError)) throw createError;
    }
  }
  if (submission.job && recovery.sourceSha256 && submission.job.sourceSha256 !== recovery.sourceSha256)
    throw new Error("提交绑定的文件摘要不一致，请重新核对任务。");
  if (!submission.job) {
    if (!file || !api.upload) throw new Error("源文件尚未上传，请重新选择原字体文件。");
    const sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (recovery.sourceSha256 && recovery.sourceSha256 !== sha) throw new Error("请选择本次提交的原字体文件，文件内容不一致。");
    recovery = { ...recovery, sourceSha256: sha }; persist(recovery);
    progress({ phase: "uploading", loaded: 0, total: file.size });
    try { await api.upload(submission, file, (bytes) => progress({ phase: "uploading", ...bytes })); }
    catch (uploadError) {
      try { submission = await api.read(submission.submissionId); } catch { throw uploadError; }
      if (!submission.job || !unknownWriteResult(uploadError)) throw uploadError;
    }
    submission = await api.read(submission.submissionId);
    if (!submission.job) throw new Error("上传结果尚未确认，请查询后继续。");
  }
  if (submission.job.status === "draft" || (submission.job.status === "failed" && retryFailed)) {
    if (submission.job.status === "failed") { recovery = { ...recovery, processRequestId: crypto.randomUUID() }; persist(recovery); }
    progress({ phase: "processing" });
    try { await api.process(submission.submissionId, recovery.processRequestId); }
    catch (processError) {
      try { submission = await api.read(submission.submissionId); } catch { throw processError; }
      if (!submission.job || ["draft", "failed"].includes(submission.job.status) || !unknownWriteResult(processError)) throw processError;
    }
    submission = await api.read(submission.submissionId);
  }
  return submission;
}
