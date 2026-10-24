"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { continueFontSubmission, fontRecoveryId, readFontRecovery, resumeFontSubmissionRecovery, saveFontRecovery } from "@/lib/admin-font-submission";
import { getAdminSessionSnapshot } from "@/lib/admin-session-store";
import { withAdminFontDeadline } from "@/api/admin-font-deadline";
import { apiClient } from "@/api/client";
import { adminUploadFetch, type UploadBytes } from "@/api/upload-progress";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
import { adminTextFontData } from "./admin-text-font-response";

export type FontSubmission = components["schemas"]["FontSubmissionDto"];
export type CreateFontSubmission = components["schemas"]["CreateFontSubmissionDto"];
export const fontSubmissionApi = {
  read: (submissionId: string, signal?: AbortSignal) => withAdminFontDeadline((deadline) => adminTextFontData(apiClient.GET("/api/v1/admin/text-fonts/submissions/{submissionId}", { params: { path: { submissionId } }, signal: deadline })), signal),
  create: (body: CreateFontSubmission) => withAdminFontDeadline((signal) => adminTextFontData(apiClient.POST("/api/v1/admin/text-fonts/submissions", { body, signal }))),
  upload: (submission: FontSubmission, file: File, progress: (bytes: UploadBytes) => void) => adminTextFontData(apiClient.POST("/api/v1/admin/text-fonts/{familyId}/sources", {
    params: { path: { familyId: submission.familyId }, query: { submissionId: submission.submissionId, expectedFamilyRevision: submission.familyRevision, format: file.name.toLowerCase().endsWith(".otf") ? "otf" : "ttf" } },
    headers: { "Content-Type": "application/octet-stream" }, body: "", bodySerializer: () => file,
    fetch: adminUploadFetch(progress),
  })),
  process: (submissionId: string, requestId: string) => withAdminFontDeadline((signal) => adminTextFontData(apiClient.POST("/api/v1/admin/text-fonts/submissions/{submissionId}/process", { params: { path: { submissionId } }, body: { requestId }, signal }))),
};
export function useAdminFontSubmission(id?: string) {
  return useQuery({ queryKey: queryKeys.admin.fontSubmission(id), enabled: Boolean(id), queryFn: ({ signal }) => fontSubmissionApi.read(id!, signal), retry: false,
    refetchInterval: (query) => query.state.data?.job && ["queued", "processing"].includes(query.state.data.job.status) ? 3000 : false });
}
export function useRefreshAdminFonts() {
  const client = useQueryClient();
  return async () => { await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.admin.textFontsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.admin.auditsRoot }),
  ]); };
}

/** 详情直接恢复简化任务；旧任务由原处理接口继续执行其授权检查。 */
export function useContinueAdminFontJob() {
  const refresh = useRefreshAdminFonts();
  return useMutation({ retry: false, mutationFn: async ({ submissionId, jobId, familyId, retryFailed }: { submissionId: string; jobId: string; familyId: string; retryFailed: boolean }) => {
    const session = getAdminSessionSnapshot();
    if (session.status !== "authenticated" || !session.data) throw new Error("请重新核验管理会话");
    const key = `admin-font-submission:${session.data.user.id}:job:${jobId}`;
    const familyRecovery = readFontRecovery(`admin-font-submission:${session.data.user.id}:${familyId}`);
    const recovery = readFontRecovery(key) ?? (familyRecovery && fontRecoveryId(familyRecovery) === submissionId ? familyRecovery : resumeFontSubmissionRecovery(submissionId));
    saveFontRecovery(key, recovery);
    const current = () => { if (session.generation !== getAdminSessionSnapshot().generation) throw new DOMException("管理会话已变化", "AbortError"); };
    return continueFontSubmission({ recovery, retryFailed, persist: (value) => saveFontRecovery(key, value), progress: () => {}, api: {
      read: async (id) => { current(); const value = await fontSubmissionApi.read(id); if (value.familyId !== familyId || value.job?.jobId !== jobId) throw new Error("任务与提交不一致，请重新读取"); return value; },
      process: (id, requestId) => { current(); return fontSubmissionApi.process(id, requestId); },
    } });
  }, onSuccess: refresh });
}
