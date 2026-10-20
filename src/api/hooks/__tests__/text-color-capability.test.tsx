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
vi.mock("@/api/use-viewer-scope", () => ({ useViewerScope: () => "color-test" }));
vi.mock("../use-thread-detail", () => ({ normalizeThreadDetail: (value: unknown) => value }));
const body = '<span data-wenyou-color-v1="#D14343">颜色</span>';
function fixture(supported?: boolean, role?: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (supported !== undefined) client.setQueryData(queryKeys.meta, { capabilities: {
    textColorV1Supported: supported, textColorV1WriteEnabled: false, roleMentionsV6Supported: role,
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
  expect(capability.textColorVersion).toBe(supported ? 1 : undefined);
  expect(Object.hasOwn(capability, "textColorVersion")).toBe(true);
  expect(capability.markdownContractVersion).toBe(supported === undefined ? undefined : 6);
});
test("颜色和角色能力互不覆盖", () => {
  const { client } = fixture(true, false);
  expect(markdownWriteCapability(client)).toEqual({ markdownContractVersion: undefined, textFontVersion: undefined, textColorVersion: 1 });
});
test("BODY 冻结省略的颜色声明不会在重试时由新能力补入", async () => {
  const { client, wrapper } = fixture(false, true);
  const frozen = markdownWriteCapability(client);
  client.setQueryData(queryKeys.meta, { capabilities: { textColorV1Supported: true, roleMentionsV6Supported: true } });
  const { result } = renderHook(() => useUpsertBody(), { wrapper });
  await act(() => result.current.mutateAsync({ subthreadId: "s1", threadId: "t1", content: "删光颜色", version: 1, ...frozen }));
  expect(request.mock.calls[0]![1].body).toMatchObject({ markdownContractVersion: 6, textColorVersion: undefined });
});
test("BODY 的颜色声明不依赖是否传入角色声明", async () => {
  const { wrapper } = fixture(true, true);
  const { result } = renderHook(() => useUpsertBody(), { wrapper });
  await act(() => result.current.mutateAsync({ subthreadId: "s1", threadId: "t1", content: body, version: 1, markdownContractVersion: undefined }));
  expect(request.mock.calls[0]![1].body).toMatchObject({ markdownContractVersion: undefined, textColorVersion: 1, content: body });
});
test("楼层、回复及删光颜色的编辑始终发送颜色能力", async () => {
  const { wrapper } = fixture(true);
  const create = renderHook(() => useCreatePost(), { wrapper });
  const update = renderHook(() => useUpdatePost(), { wrapper });
  await act(() => create.result.current.mutateAsync({ subthreadId: "s1", content: body, clientRequestId: "x" }));
  await act(() => create.result.current.mutateAsync({ subthreadId: "s1", content: body, parentPostId: "p1", clientRequestId: "y" }));
  await act(() => update.result.current.mutateAsync({ postId: "p1", content: "颜色", version: 1 }));
  for (const call of request.mock.calls) expect(call[1].body.textColorVersion).toBe(1);
});
test("正文草稿创建与重开更新保留颜色源", async () => {
  const { wrapper } = fixture(true);
  const { result } = renderHook(() => useSaveDraft(), { wrapper });
  await act(() => result.current.mutateAsync({ content: body, slot: 1 }));
  await act(() => result.current.mutateAsync({ content: body, draftId: "d1", version: 1 }));
  for (const call of request.mock.calls) expect(call[1].body).toMatchObject({ textColorVersion: 1, content: body });
});
test("主贴聚合正文在删除全部颜色后仍声明支持", async () => {
  const { wrapper } = fixture(true);
  const { result } = renderHook(() => useSaveThreadAggregate(), { wrapper });
  await act(() => result.current.mutateAsync({ threadId: "t1", body: { content: "去色", version: 1, defaultSubthreadVersion: 1, tagNames: [] } }));
  expect(request.mock.calls[0]![1].body).toMatchObject({ textColorVersion: 1, content: "去色" });
});
