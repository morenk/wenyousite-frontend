import { beforeEach, expect, test, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { markdownWriteCapability } from "@/api/markdown-capability";
import { queryKeys } from "@/api/query-keys";
import { useUpsertBody } from "../use-upsert-body";
import { useSaveDraft } from "../use-save-draft";
import { useCreatePost } from "../use-create-post";
import { useUpdatePost } from "../use-update-post";
import { useSaveThreadAggregate } from "../use-save-thread-aggregate";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: { POST: request, PUT: request, PATCH: request } }));
vi.mock("@/api/use-viewer-scope", () => ({ useViewerScope: () => "font-test" }));
vi.mock("../use-thread-detail", () => ({ normalizeThreadDetail: (value: unknown) => value }));
const body = '<span data-wenyou-font-v1="wenkai">字体</span>';
function fixture(supported?: boolean, role?: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (supported !== undefined) client.setQueryData(queryKeys.meta, { capabilities: {
    textFontV1Supported: supported, textFontV1WriteEnabled: false, roleMentionsV6Supported: role,
  } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, wrapper: Wrapper };
}
beforeEach(() => request.mockReset().mockResolvedValue({ data: { data: { id: "saved", version: 2 } } }));

test.each([undefined, false, true])("正文写能力由独立 supported=%s 决定，关闭新写仍声明保源能力", (supported) => {
  const { client } = fixture(supported, true);
  const capability = markdownWriteCapability(client);
  expect(capability.textFontVersion).toBe(supported ? 1 : undefined);
  expect(Object.hasOwn(capability, "textFontVersion")).toBe(true);
  expect(capability.markdownContractVersion).toBe(supported === undefined ? undefined : 6);
});
test("字体和角色能力互不覆盖", () => {
  const { client } = fixture(true, false);
  expect(markdownWriteCapability(client)).toEqual({ markdownContractVersion: undefined, textColorVersion: undefined, textFontVersion: 1 });
});
test("BODY 冻结省略的字体声明不会在重试时由新能力补入", async () => {
  const { client, wrapper } = fixture(false, true);
  const frozen = markdownWriteCapability(client);
  client.setQueryData(queryKeys.meta, { capabilities: { textFontV1Supported: true, roleMentionsV6Supported: true } });
  const { result } = renderHook(() => useUpsertBody(), { wrapper });
  await act(() => result.current.mutateAsync({ subthreadId: "s1", threadId: "t1", content: "删光字体", version: 1, ...frozen }));
  expect(request.mock.calls[0]![1].body).toMatchObject({ markdownContractVersion: 6, textFontVersion: undefined });
});
test("BODY 的字体声明不依赖是否传入角色声明", async () => {
  const { wrapper } = fixture(true, true);
  const { result } = renderHook(() => useUpsertBody(), { wrapper });
  await act(() => result.current.mutateAsync({ subthreadId: "s1", threadId: "t1", content: body, version: 1, markdownContractVersion: undefined }));
  expect(request.mock.calls[0]![1].body).toMatchObject({ markdownContractVersion: undefined, textFontVersion: 1, content: body });
});
test("楼层、回复及删光字体的编辑始终发送字体能力", async () => {
  const { wrapper } = fixture(true);
  const create = renderHook(() => useCreatePost(), { wrapper });
  const update = renderHook(() => useUpdatePost(), { wrapper });
  await act(() => create.result.current.mutateAsync({ subthreadId: "s1", content: body, clientRequestId: "x" }));
  await act(() => create.result.current.mutateAsync({ subthreadId: "s1", content: body, parentPostId: "p1", clientRequestId: "y" }));
  await act(() => update.result.current.mutateAsync({ postId: "p1", content: "字体", version: 1 }));
  for (const call of request.mock.calls) expect(call[1].body.textFontVersion).toBe(1);
});
test("正文草稿创建与重开更新保留字体源", async () => {
  const { wrapper } = fixture(true);
  const { result } = renderHook(() => useSaveDraft(), { wrapper });
  await act(() => result.current.mutateAsync({ content: body, slot: 1 }));
  await act(() => result.current.mutateAsync({ content: body, draftId: "d1", version: 1 }));
  for (const call of request.mock.calls) expect(call[1].body).toMatchObject({ textFontVersion: 1, content: body });
});
test("主贴聚合正文在删除全部字体后仍声明支持", async () => {
  const { wrapper } = fixture(true);
  const { result } = renderHook(() => useSaveThreadAggregate(), { wrapper });
  await act(() => result.current.mutateAsync({ threadId: "t1", body: { content: "去字体", version: 1, defaultSubthreadVersion: 1, tagNames: [] } }));
  expect(request.mock.calls[0]![1].body).toMatchObject({ textFontVersion: 1, content: "去字体" });
});


test.each([40019, 40020])("字体能力拒绝%s刷新meta而保留本次输入", async (code) => {
  const { invalidateChangedMentionCandidates } = await import("../use-mention-candidates");
  const { client } = fixture(true);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  await invalidateChangedMentionCandidates(client, { code, message: "capability changed" });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.meta });
});
