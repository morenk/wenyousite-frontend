import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { usePost } from "@/api/hooks/use-post";
import { useThreadDetail } from "@/api/hooks/use-thread-detail";
import { queryKeys } from "@/api/query-keys";
import { AuthProvider } from "@/lib/auth";
import { AUTH_SESSION_MARKER_KEY, clearAuthSession, getAuthSnapshot, setAuthSession } from "@/lib/auth-store";
import { createQueryWrapper } from "@/test/query-client";

const { mockGET, bootstrap } = vi.hoisted(() => ({ mockGET: vi.fn(), bootstrap: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: { GET: mockGET }, bootstrapAuthSession: bootstrap }));
vi.mock("next/navigation", () => ({ usePathname: () => "/threads/thread-1" }));

const user = { id: "member-1", email: "fixture@example.invalid", username: "fixture", avatar: null, role: "USER" };
const post = { id: "post-1", threadId: "thread-1", content: "fixture" };
const thread = { id: "thread-1", title: "fixture", defaultSubthreadId: "sub-1", subthreads: [{ id: "sub-1" }] };

function mountDetails() {
  const { client, Wrapper: QueryWrapper } = createQueryWrapper();
  function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider><QueryWrapper>{children}</QueryWrapper></AuthProvider>;
  }
  return { client, ...renderHook(() => ({
    post: usePost("post-1"), thread: useThreadDetail("thread-1"),
  }), { wrapper: Wrapper }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAuthSession();
  mockGET.mockImplementation(async (path: string) => ({
    data: { code: 0, data: path === "/api/v1/posts/{id}" ? post : thread },
  }));
});
afterEach(() => { cleanup(); clearAuthSession(); });

test.each(["member", "anonymous", "offline"])("真实 AuthProvider 恢复为 %s 后才查询详情", async (mode) => {
  let finish!: () => void;
  bootstrap.mockImplementationOnce(() => new Promise<void>((resolve, reject) => {
    finish = () => {
      if (mode === "member") setAuthSession(user, "synthetic-token");
      if (mode === "offline") reject(new Error("fixture offline"));
      else resolve();
    };
  }));
  const { result, client } = mountDetails();
  expect(bootstrap).toHaveBeenCalledOnce();
  expect(result.current.post.fetchStatus).toBe("idle");
  expect(result.current.thread.fetchStatus).toBe("idle");
  expect(mockGET).not.toHaveBeenCalled();

  await act(async () => { finish(); });
  await waitFor(() => {
    expect(result.current.post.isSuccess).toBe(true);
    expect(result.current.thread.isSuccess).toBe(true);
  });
  expect(mockGET).toHaveBeenCalledTimes(2);
  const scope = mode === "member" ? user.id : "anonymous";
  expect(client.getQueryData(queryKeys.posts.detailForViewer("post-1", scope))).toEqual(post);
  expect(client.getQueryData(queryKeys.threads.detailForViewer("thread-1", scope))).toMatchObject(thread);
  expect(getAuthSnapshot().user?.id ?? "anonymous").toBe(scope);
  if (mode === "member") {
    expect(client.getQueryData(queryKeys.posts.detailForViewer("post-1", "anonymous"))).toBeUndefined();
    expect(client.getQueryData(queryKeys.threads.detailForViewer("thread-1", "anonymous"))).toBeUndefined();
  }
});

test("初始化完成后的真实 404 保留错误且不重试", async () => {
  bootstrap.mockResolvedValueOnce(undefined);
  const missing = { code: 40402, message: "主题帖不存在" };
  mockGET.mockResolvedValue({ error: missing });
  const { result } = mountDetails();
  await waitFor(() => {
    expect(result.current.post.error).toEqual(missing);
    expect(result.current.thread.error).toEqual(missing);
  });
  expect(mockGET).toHaveBeenCalledTimes(2);
});

test("跨标签页重新恢复时暂停详情，完成后按新用户读取", async () => {
  bootstrap.mockImplementationOnce(async () => { setAuthSession(user, "synthetic-token"); });
  const { result, client } = mountDetails();
  await waitFor(() => expect(result.current.thread.isSuccess && result.current.post.isSuccess).toBe(true));
  mockGET.mockClear();
  let finish!: () => void;
  bootstrap.mockImplementationOnce(() => new Promise<void>((resolve) => {
    finish = () => { setAuthSession({ ...user, id: "member-2" }, "synthetic-token-2"); resolve(); };
  }));
  await act(async () => {
    window.dispatchEvent(new StorageEvent("storage", {
      key: AUTH_SESSION_MARKER_KEY, newValue: JSON.stringify({ userId: "member-2", revision: "fixture" }),
    }));
  });
  expect(result.current.post.fetchStatus).toBe("idle");
  expect(result.current.thread.fetchStatus).toBe("idle");
  expect(mockGET).not.toHaveBeenCalled();
  await act(async () => { finish(); });
  await waitFor(() => expect(mockGET).toHaveBeenCalledTimes(2));
  expect(client.getQueryData(queryKeys.posts.detailForViewer("post-1", "member-2"))).toEqual(post);
  expect(client.getQueryData(queryKeys.threads.detailForViewer("thread-1", "member-2"))).toMatchObject(thread);
});
