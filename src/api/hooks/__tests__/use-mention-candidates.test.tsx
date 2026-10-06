import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useMentionCandidates } from "@/api/hooks/use-mention-candidates";
import { createQueryWrapper } from "@/test/query-client";

const { mockGET, mockMeta } = vi.hoisted(() => ({ mockGET: vi.fn(), mockMeta: vi.fn() }));
vi.mock("@/api/hooks/use-api-meta", () => ({ useApiMeta: mockMeta }));
vi.mock("@/api/client", () => ({ apiClient: { GET: mockGET } }));

beforeEach(() => { vi.clearAllMocks(); mockMeta.mockReturnValue({ data: { markdownContractVersion: 5 } }); });

describe("useMentionCandidates", () => {
  test("带关键词查询主题帖可提及用户", async () => {
    const candidates = {
      users: [{ id: "u2", username: "玩家二", relation: "PLAYER" }],
      canMentionAllPlayers: true,
    };
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: candidates },
      error: undefined,
    });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useMentionCandidates("t1", "玩家", true),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.data).toEqual(candidates));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/mention-candidates", {
      params: { query: { threadId: "t1", q: "玩家" } },
    });
  });

  test("空关键词不发送 q 参数", async () => {
    mockGET.mockResolvedValue({ data: { data: { users: [], canMentionAllPlayers: false } } });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useMentionCandidates("t1", "", true),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/mention-candidates", {
      params: { query: { threadId: "t1" } },
    });
  });

  test("空成功响应回退为空候选集合", async () => {
    mockGET.mockResolvedValue({ data: undefined, error: undefined });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useMentionCandidates("t1", "", true),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.data).toEqual({ users: [], canMentionAllPlayers: false });
    });
  });

  test.each([
    [undefined, true],
    ["t1", false],
  ] as const)("threadId=%s enabled=%s 时不请求", (threadId, enabled) => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useMentionCandidates(threadId, "玩家", enabled),
      { wrapper: Wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGET).not.toHaveBeenCalled();
  });

  test("API 错误进入错误态", async () => {
    const error = { message: "无权获取候选人" };
    mockGET.mockResolvedValue({ data: undefined, error });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useMentionCandidates("t1", "", true),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.error).toEqual(error));
  });
});

test.each([true, false])("新后端supported=true gate=%s始终optin，空列表不回退主身份", async (enabled) => {
  mockMeta.mockReturnValue({ data: { capabilities: { roleMentionsV6Supported: true, roleMentionsV6WriteEnabled: enabled } } });
  mockGET.mockResolvedValue({ data: { data: { users: [], canMentionAllPlayers: true } } });
  const { Wrapper } = createQueryWrapper();
  const { result } = renderHook(() => useMentionCandidates("t1", "同名", true), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mockGET).toHaveBeenCalledTimes(1);
  expect(mockGET).toHaveBeenCalledWith("/api/v1/users/mention-candidates", { params: { query: { threadId: "t1", q: "同名", includeIdentities: true } } });
  expect(result.current.userMentionsUnavailable).toBe(!enabled);
  expect(result.current.data?.canMentionAllPlayers).toBe(true);
});
test("能力尚未确定时不抢先发旧候选请求", () => {
  mockMeta.mockReturnValue({ data: undefined, isFetching: true });
  const { Wrapper } = createQueryWrapper();
  const { result } = renderHook(() => useMentionCandidates("t1", "", true), { wrapper: Wrapper });
  expect(mockGET).not.toHaveBeenCalled();
  expect(result.current.isFetching).toBe(true);
});

test("新写能力变为关闭时不继续展示缓存中的平级用户候选", async () => {
  mockMeta.mockReturnValue({ data: { capabilities: { roleMentionsV6Supported: true, roleMentionsV6WriteEnabled: true } } });
  mockGET.mockResolvedValue({ data: { data: { users: [{ id: "u1", candidateKey: "RP:a", username: "账号" }], canMentionAllPlayers: true } } });
  const { Wrapper } = createQueryWrapper();
  const { result, rerender } = renderHook(() => useMentionCandidates("t1", "", true), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.data?.users).toHaveLength(1));
  mockMeta.mockReturnValue({ data: { capabilities: { roleMentionsV6Supported: true, roleMentionsV6WriteEnabled: false } } });
  rerender();
  expect(result.current.data?.users).toEqual([]);
  expect(result.current.data?.canMentionAllPlayers).toBe(true);
  expect(result.current.userMentionsUnavailable).toBe(true);
  expect(mockGET).toHaveBeenCalledTimes(1);
});
