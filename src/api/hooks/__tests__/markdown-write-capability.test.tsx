import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { createQueryWrapper } from "@/test/query-client";
import { markdownWriteCapability } from "@/api/markdown-capability";
import { queryKeys } from "@/api/query-keys";
import { useCreateThread } from "../use-create-thread";
import { useCreatePost } from "../use-create-post";
import { useUpdatePost } from "../use-update-post";
import { useUpsertBody } from "../use-upsert-body";
import { useSaveThreadAggregate } from "../use-save-thread-aggregate";
import { useCreateSubthread } from "../use-create-subthread";
import { useSaveDraft } from "../use-save-draft";
const { write } = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: { POST: write, PUT: write, PATCH: write } }));
vi.mock("@/api/use-viewer-scope", () => ({ useViewerScope: () => "u1" }));
beforeEach(() => { vi.clearAllMocks(); write.mockResolvedValue({ data: { data: { id: "x", title: "新主题", defaultSubthreadId: "s1", content: "正文", subthreads: [{ id: "s1", title: "主贴", postingPolicy: "PARTICIPANTS", postingCapability: { canPost: true, denialReason: null } }] } } }); });

test.each([true, false])("八种正文写入：supported=%s，与新写开关无关；删光旧源仍声明能力", async (supported) => {
  const { Wrapper, client } = createQueryWrapper();
  client.setQueryData(queryKeys.meta, { capabilities: { roleMentionsV6Supported: supported, roleMentionsV6WriteEnabled: false } });
  const { result } = renderHook(() => ({
    thread: useCreateThread(), create: useCreatePost(), update: useUpdatePost(), body: useUpsertBody(),
    aggregate: useSaveThreadAggregate(), subthread: useCreateSubthread(), draft: useSaveDraft(),
  }), { wrapper: Wrapper });
  await act(async () => {
    await result.current.thread.mutateAsync({ title: "新主题", category: "RPG", visibility: "PUBLIC", subthreadTitle: "主帖", content: "正文", tagNames: [], clientRequestId: "thread-request" });
    await result.current.create.mutateAsync({ subthreadId: "s1", content: "正文", clientRequestId: "request" });
    await result.current.update.mutateAsync({ postId: "p1", content: "删除全部角色提及", version: 2 });
    await result.current.body.mutateAsync({ subthreadId: "s1", threadId: "t1", content: "正文" });
    await result.current.aggregate.mutateAsync({ threadId: "t1", body: { version: 1, defaultSubthreadVersion: 1, content: "正文", tagNames: [] } });
    await result.current.subthread.mutateAsync({ threadId: "t1", body: { title: "子贴", postingPolicy: "PARTICIPANTS", content: "正文", clientRequestId: "request" } });
    await result.current.draft.mutateAsync({ content: "正文", clientRequestId: "draft-request" });
    await result.current.draft.mutateAsync({ draftId: "d1", content: "删除全部角色提及", version: 1 });
  });
  expect(write).toHaveBeenCalledTimes(8);
  for (const [, options] of write.mock.calls) expect(options.body.markdownContractVersion).toBe(supported ? 6 : undefined);
});

test.each([true, false])("未知结果请求冻结能力（原supported=%s），meta变化不改四种发言入口的原载荷", async (supported) => {
  const { Wrapper, client } = createQueryWrapper();
  client.setQueryData(queryKeys.meta, { capabilities: { roleMentionsV6Supported: supported } });
  const frozen = markdownWriteCapability(client);
  const { result } = renderHook(() => ({
    create: useCreatePost(), body: useUpsertBody(), aggregate: useSaveThreadAggregate(), subthread: useCreateSubthread(),
  }), { wrapper: Wrapper });
  client.setQueryData(queryKeys.meta, { capabilities: { roleMentionsV6Supported: !supported } });
  await act(async () => {
    await result.current.create.mutateAsync({ subthreadId: "s1", content: "原正文", clientRequestId: "request", ...frozen });
    await result.current.body.mutateAsync({ subthreadId: "s1", threadId: "t1", content: "原正文", ...frozen });
    await result.current.aggregate.mutateAsync({ threadId: "t1", body: { version: 1, defaultSubthreadVersion: 1, content: "原正文", tagNames: [], ...frozen } });
    await result.current.subthread.mutateAsync({ threadId: "t1", body: { title: "子贴", postingPolicy: "PARTICIPANTS", content: "原正文", clientRequestId: "request", ...frozen } });
  });
  for (const [, options] of write.mock.calls) expect(options.body.markdownContractVersion).toBe(supported ? 6 : undefined);
});
