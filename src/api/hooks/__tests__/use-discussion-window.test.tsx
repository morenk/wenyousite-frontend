import { beforeEach, describe, expect, test, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { removeDiscussionWindowPost, useFloorWindow, useReplyWindow } from "../use-discussion-window";
import { queryKeys } from "@/api/query-keys";
const { get, viewer } = vi.hoisted(() => ({ get: vi.fn(), viewer: { id: "viewer-a" } }));
vi.mock("@/api/client", () => ({ apiClient: { GET: get } }));
vi.mock("@/api/use-viewer-scope", () => ({ useViewerScope: () => viewer.id }));
const filters = { order: "OLDEST" as const };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
function response(start = 1, target: number | null = null) {
  return { data: { data: { items: Array.from({ length: 20 }, (_, index) => ({ id: `p${start + index}`, floorNumber: start + index, replyNumber: start + index })), pinnedItems: [], total: 10_000, maxNumber: 10_000, target: target ? { id: `p${target}`, number: target } : null, beforeCursor: start > 1 ? `before-${start}` : null, afterCursor: `after-${start + 19}`, hasBefore: start > 1, hasAfter: true } } };
}
beforeEach(() => { get.mockReset(); viewer.id = "viewer-a"; });
describe("讨论小窗口", () => {
  test("深链和万楼数字各一次目标窗口请求，不扫描前页", async () => {
    get.mockResolvedValue(response(4991, 5000));
    const { wrapper } = setup();
    const { result } = renderHook(() => useFloorWindow("s", filters, "p5000"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1].params.query).toMatchObject({ postId: "p5000", limit: 20 });
    get.mockResolvedValue(response(9991, 10_000));
    await act(async () => { await result.current.locate({ number: 10_000 }); });
    expect(get).toHaveBeenCalledTimes(2);
    expect(result.current.data?.pages).toHaveLength(1);
    await waitFor(() => expect(result.current.data?.pages[0].window.target?.number).toBe(10_000));
  });
  test("前后游标续读最多五页，置顶抑制集合跨裁剪保留，跳转清空", async () => {
    const first = response(); first.data.data.pinnedItems = [{ id: "p8", floorNumber: 8, replyNumber: 8 }] as never[];
    get.mockResolvedValueOnce(first);
    const { wrapper } = setup();
    const { result } = renderHook(() => useFloorWindow("s", filters), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (let start = 21; start <= 141; start += 20) {
      get.mockResolvedValueOnce(response(start));
      await act(async () => { await result.current.fetchNextPage(); });
      await waitFor(() => expect(result.current.data?.pages.at(-1)?.data[0].id).toBe(`p${start}`));
    }
    expect(result.current.data?.pages).toHaveLength(5);
    expect(result.current.data?.pages.flatMap((page) => page.data)).toHaveLength(100);
    expect(result.current.pinnedItems.map((item) => item.id)).toEqual(["p8"]);
    get.mockResolvedValueOnce(response(41));
    await act(async () => { await result.current.fetchPreviousPage(); });
    expect(get.mock.calls.at(-1)?.[1].params.query.cursor).toBe("before-61");
    get.mockResolvedValueOnce(response(4991, 5000));
    await act(async () => { await result.current.locate({ number: 5000 }); });
    await waitFor(() => expect(result.current.pinnedItems).toEqual([]));
  });
  test("保护选区和编辑页，不让裁剪丢掉正文，释放后继续", async () => {
    get.mockResolvedValue(response());
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ protectedIds }) => useFloorWindow("s", filters, undefined, protectedIds), { wrapper, initialProps: { protectedIds: ["p1"] } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (let start = 21; start <= 81; start += 20) { get.mockResolvedValueOnce(response(start)); await act(async () => { await result.current.fetchNextPage(); }); await waitFor(() => expect(result.current.data?.pages.at(-1)?.data[0].id).toBe(`p${start}`)); }
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    const calls = get.mock.calls.length;
    await act(async () => { await result.current.fetchNextPage(); });
    expect(get).toHaveBeenCalledTimes(calls);
    rerender({ protectedIds: [] });
    expect(result.current.hasNextPage).toBe(true);
  });
  test("翻页发出后新建选区也阻止裁剪，取消后不会卡在加载中", async () => {
    get.mockResolvedValue(response());
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ protectedIds }) => useFloorWindow("s", filters, undefined, protectedIds), { wrapper, initialProps: { protectedIds: [] as string[] } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (let start = 21; start <= 81; start += 20) { get.mockResolvedValueOnce(response(start)); await act(async () => { await result.current.fetchNextPage(); }); await waitFor(() => expect(result.current.data?.pages.at(-1)?.data[0].id).toBe(`p${start}`)); }
    let resolve!: (value: ReturnType<typeof response>) => void;
    get.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.fetchNextPage(); });
    rerender({ protectedIds: ["p1"] });
    await act(async () => { resolve(response(101)); await pending; });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data?.pages[0].data[0].id).toBe("p1");
    expect(result.current.data?.pages).toHaveLength(5);
    expect(result.current.error).toBeNull();
  });
  test("关闭、scope或viewer切换会丢弃延迟定位，不污染当前窗", async () => {
    get.mockResolvedValue(response());
    const { client, wrapper } = setup();
    const { result, rerender } = renderHook(({ id }) => useFloorWindow(id, filters), { wrapper, initialProps: { id: "s" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    let resolve!: (value: ReturnType<typeof response>) => void;
    get.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.locate({ number: 5000 }).catch((error) => error); });
    viewer.id = "viewer-b"; rerender({ id: "other" });
    await act(async () => { resolve(response(4991, 5000)); await pending; });
    expect(client.getQueryData<{ pages: { data: { id: string }[] }[] }>(queryKeys.floors.window("s", filters, "viewer-a"))?.pages[0].data[0].id).toBe("p1");
    await waitFor(() => expect(result.current.data?.pages[0].window.target).toBeNull());
  });
  test("无法定位和返回已删除条目不会清空当前窗口", async () => {
    get.mockResolvedValue(response(4991, 5000));
    const { wrapper } = setup();
    const { result } = renderHook(() => useReplyWindow("p", filters), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const old = result.current.data;
    get.mockResolvedValueOnce({ error: { code: 40403, message: "回复不存在" } });
    await expect(result.current.locate({ postId: "deleted" })).rejects.toMatchObject({ code: 40403 });
    expect(result.current.data).toBe(old);
  });
  test("删除数字定位目标会移除条目并以邻居刷新，不继续请求已删编号", async () => {
    get.mockResolvedValue(response(4991, 5000));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useFloorWindow("s", filters), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => { await result.current.locate({ number: 5000 }); });
    act(() => { removeDiscussionWindowPost(client, "p5000"); });
    await waitFor(() => expect(result.current.data?.pages[0].data.some((item) => item.id === "p5000")).toBe(false));
    expect(result.current.data?.pageParams[0]).toEqual({ postId: "p4991" });
    get.mockResolvedValueOnce(response(4981, 4991));
    await act(async () => { await result.current.refetch(); });
    expect(get.mock.calls.at(-1)?.[1].params.query).toMatchObject({ postId: "p4991" });
  });
  test("向前请求在途时折返末页，返回响应不能裁掉当前可见条目", async () => {
    get.mockResolvedValue(response(21));
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ visibleId }) => useReplyWindow("p", filters, undefined, [visibleId]), { wrapper, initialProps: { visibleId: "p21" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (let start = 41; start <= 101; start += 20) { get.mockResolvedValueOnce(response(start)); await act(async () => { await result.current.fetchNextPage(); }); await waitFor(() => expect(result.current.data?.pages.at(-1)?.data[0].id).toBe(`p${start}`)); }
    let resolve!: (value: ReturnType<typeof response>) => void;
    get.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.fetchPreviousPage(); });
    rerender({ visibleId: "p110" });
    await act(async () => { resolve(response(1)); await pending; });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data?.pages).toHaveLength(5);
    expect(result.current.data?.pages.at(-1)?.data.some((item) => item.id === "p110")).toBe(true);
    expect(result.current.error).toBeNull();
    rerender({ visibleId: "p21" });
    get.mockResolvedValueOnce(response(1));
    await act(async () => { await result.current.fetchPreviousPage(); });
    await waitFor(() => expect(result.current.data?.pages[0].data[0].id).toBe("p1"));
  });

  test("首屏裁剪后的失效重取刷新置顶正文、回复数与取消置顶，只补一个默认窗", async () => {
    const first = response();
    first.data.data.pinnedItems = [{ id: "p8", content: "原正文", _count: { replies: 1 } }] as never[];
    get.mockResolvedValueOnce(first);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useFloorWindow("s", filters), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (let start = 21; start <= 101; start += 20) { get.mockResolvedValueOnce(response(start)); await act(async () => { await result.current.fetchNextPage(); }); await waitFor(() => expect(result.current.data?.pages.at(-1)?.data[0].id).toBe(`p${start}`)); }
    let pins = [{ id: "p8", content: "编辑后的正文", _count: { replies: 2 } }];
    get.mockClear();
    get.mockImplementation((_path, options) => {
      const cursor = options.params.query.cursor as string | undefined;
      const start = cursor ? Number(cursor.split("-")[1]) + 1 : 1;
      const value = response(start);
      value.data.data.pinnedItems = cursor ? [] : pins as never[];
      return Promise.resolve(value);
    });
    await act(async () => { await client.invalidateQueries({ queryKey: queryKeys.floors.all }); });
    expect(get.mock.calls.filter(([, options]) => !options.params.query.cursor)).toHaveLength(1);
    expect(get).toHaveBeenCalledTimes(6);
    expect(result.current.data?.pages[0].data[0].id).toBe("p21");
    await waitFor(() => expect(result.current.data?.pages.every((page) => page.window.pinnedItems[0]?.content === "编辑后的正文" && page.window.pinnedItems[0]?._count.replies === 2)).toBe(true));
    pins = [];
    await act(async () => { await client.invalidateQueries({ queryKey: queryKeys.floors.all }); });
    await waitFor(() => expect(result.current.pinnedItems).toEqual([]));
    expect(result.current.data?.pages.every((page) => page.window.pinnedItems.length === 0)).toBe(true);
    expect(result.current.data?.pages[0].data[0].id).toBe("p21");
  });
  test("精确跳转窗经过裁剪和重取仍不补首屏或恢复置顶区", async () => {
    get.mockResolvedValueOnce(response(4991, 5000));
    const { wrapper } = setup();
    const { result } = renderHook(() => useFloorWindow("s", filters, "p5000"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (let start = 5011; start <= 5091; start += 20) { get.mockResolvedValueOnce(response(start)); await act(async () => { await result.current.fetchNextPage(); }); await waitFor(() => expect(result.current.data?.pages.at(-1)?.data[0].id).toBe(`p${start}`)); }
    get.mockClear();
    get.mockImplementation((_path, options) => Promise.resolve(response(Number(options.params.query.cursor.split("-")[1]) + 1)));
    await act(async () => { await result.current.refetch(); });
    expect(get).toHaveBeenCalledTimes(5);
    expect(get.mock.calls.every(([, options]) => Boolean(options.params.query.cursor))).toBe(true);
    expect(result.current.pinnedItems).toEqual([]);
  });

});
