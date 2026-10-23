import { cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useContinueAdminFontJob } from "../admin/use-admin-font-submission";
import { acceptAdminSession, beginAdminSessionChange } from "@/lib/admin-session-store";
import type { FontSubmission } from "../admin/use-admin-font-submission";
const id = "f48fc025-1ff4-48b5-b6c2-fc9ae6517f79", familyId = "tff_" + "a".repeat(32), jobId = "tfj_" + "b".repeat(32);
const submission: FontSubmission = { submissionId: id, familyId, familyRevision: 8, name: "字体", language: "other", sortOrder: 0, authorizationRuleVersion: "admin-font-upload-v1", createdAt: "", updatedAt: "", job: { jobId, familyId, status: "draft", sourceSha256: "a".repeat(64), sourceBytes: 4, versionId: null, failureCode: null } };
beforeEach(() => {
  sessionStorage.clear(); const generation = beginAdminSessionChange();
  acceptAdminSession({ csrfToken: "test-only", user: { id: "test-admin", role: "ADMIN" }, session: { id: "test-session", createdAt: "", lastActiveAt: "", expiresAt: "2099-01-01T00:00:00Z", elevatedUntil: null } }, generation);
});
afterEach(() => { cleanup(); beginAdminSessionChange(); vi.restoreAllMocks(); });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { ...renderHook(() => useContinueAdminFontJob(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }), client };
}
test("从详情job提交标识恢复，无浏览器历史也先GET，再处理已上传源；不创建或重传", async () => {
  const calls: Request[] = []; let started = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request; calls.push(request);
    if (request.method === "POST") started = true;
    return Response.json({ code: 0, message: "ok", data: request.method === "POST" ? submission.job : { ...submission, job: { ...submission.job!, status: started ? "queued" : "draft" } } });
  });
  const { result, client } = setup(); await result.current.mutateAsync({ submissionId: id, familyId, jobId, retryFailed: false });
  expect(calls.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
    ["GET", `/api/v1/admin/text-fonts/submissions/${id}`], ["POST", `/api/v1/admin/text-fonts/submissions/${id}/process`], ["GET", `/api/v1/admin/text-fonts/submissions/${id}`],
  ]);
  const key = JSON.parse(sessionStorage.getItem(`admin-font-submission:test-admin:job:${jobId}`)!);
  expect(await calls[1]!.json()).toEqual({ requestId: key.firstProcessRequestId });
  expect(calls[1]!.headers.get("X-CSRF-Token")).toBe("test-only"); client.clear();
});
test("错误家族或任务映射不能发处理请求", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ code: 0, message: "ok", data: { ...submission, familyId: "different" } }));
  const { result, client } = setup(); await expect(result.current.mutateAsync({ submissionId: id, familyId, jobId, retryFailed: true })).rejects.toThrow("任务与提交不一致");
  expect(fetch).toHaveBeenCalledOnce(); client.clear();
});

test("历史job绑定已不存在时不重建提交或重传源", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ code: 40400, message: "not found", data: null }, { status: 404 }));
  const { result, client } = setup();
  await expect(result.current.mutateAsync({ submissionId: id, familyId, jobId, retryFailed: false })).rejects.toMatchObject({ status: 404 });
  expect(fetch).toHaveBeenCalledOnce(); client.clear();
});
