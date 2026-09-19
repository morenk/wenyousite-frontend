import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { queryKeys } from "@/api/query-keys";
import { useDeleteBookmarkFolder, useRenameBookmarkFolder, type BookmarkFolderKind } from "../use-bookmark-folders";

const { PATCH, DELETE } = vi.hoisted(() => ({ PATCH: vi.fn(), DELETE: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: { PATCH, DELETE } }));
beforeEach(() => vi.clearAllMocks());
const custom = { id: "custom", name: "原名", isDefault: false, itemCount: 2, createdAt: "2026-09-01" };
const destination = { ...custom, id: "default", name: "默认收藏夹", isDefault: true, itemCount: 3 };
const page = (items: { id: string; bookmarkFolderId: string }[]) => ({ pages: [{ code: 0, message: "ok", data: items, meta: { cursor: "next", hasMore: true } }], pageParams: [undefined] });
function setup(kind: BookmarkFolderKind) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const key = (folder?: string) => kind === "threads" ? queryKeys.bookmarks.list(folder) : queryKeys.moments.bookmarks("viewer", folder);
  const other: BookmarkFolderKind = kind === "threads" ? "moments" : "threads";
  client.setQueryData(queryKeys.bookmarks.folders(kind), [destination, custom]);
  client.setQueryData(queryKeys.bookmarks.folders(other), [destination, custom]);
  const source = page([{ id: "a", bookmarkFolderId: "custom" }]);
  const target = page([{ id: "b", bookmarkFolderId: "default" }]);
  client.setQueryData(key("custom"), source);
  client.setQueryData(key("default"), target);
  client.setQueryData(key(), page([...source.pages[0].data, ...target.pages[0].data, { id: "all-only", bookmarkFolderId: "custom" }]));
  const untouched = [queryKeys.users.bookmarks("viewer"), queryKeys.moments.bookmarks("other-viewer", "custom"),
    kind === "threads" ? queryKeys.moments.bookmarks("viewer", "custom") : queryKeys.bookmarks.list("custom")];
  for (const item of untouched) client.setQueryData(item, source);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, key, other, source, target, untouched, invalidate, wrapper };
}
for (const kind of ["threads", "moments"] as const) {
  const path = kind === "threads" ? "/api/v1/bookmarks/folders/{id}" : "/api/v1/moments/bookmark-folders/{id}";
  test(`${kind} 重命名保留 ID、更新名称和计数，仅失效本类私有列表`, async () => {
    const s = setup(kind);
    PATCH.mockResolvedValue({ data: { data: { ...custom, name: "新名", bookmarkCount: 2, momentBookmarkCount: 2 } } });
    const { result } = renderHook(() => useRenameBookmarkFolder(kind, "viewer"), { wrapper: s.wrapper });
    await act(async () => { await result.current.mutateAsync({ id: "custom", name: "  新名  " }); });
    expect(PATCH).toHaveBeenCalledWith(path, { params: { path: { id: "custom" } }, body: { name: "新名" } });
    expect(s.client.getQueryData(queryKeys.bookmarks.folders(kind))).toEqual([destination, { ...custom, name: "新名" }]);
    expect(s.client.getQueryData(s.key("custom"))).toEqual(s.source);
    expect(s.client.getQueryState(s.key("custom"))?.isInvalidated).toBe(true);
    expect(s.client.getQueryData(queryKeys.bookmarks.folders(s.other))).toEqual([destination, custom]);
    for (const key of s.untouched) expect(s.client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(s.invalidate).toHaveBeenCalledTimes(2);
  });
  test.each([true, false])(`${kind} 删除迁移计数和已知列表、移除旧夹查询（目标缓存 %s）`, async (cached) => {
    const s = setup(kind);
    if (!cached) s.client.removeQueries({ queryKey: s.key("default"), exact: true });
    DELETE.mockResolvedValue({ data: { data: { deletedFolderId: "custom", destinationFolderId: "default" } } });
    const { result } = renderHook(() => useDeleteBookmarkFolder(kind, "viewer"), { wrapper: s.wrapper });
    await act(async () => { await result.current.mutateAsync("custom"); });
    expect(DELETE).toHaveBeenCalledWith(path, { params: { path: { id: "custom" } } });
    expect(s.client.getQueryData(queryKeys.bookmarks.folders(kind))).toEqual([{ ...destination, itemCount: 5 }]);
    expect(s.client.getQueryState(s.key("custom"))).toBeUndefined();
    const data = s.client.getQueryData<ReturnType<typeof page>>(s.key("default"))!;
    expect(data.pages[0].meta).toEqual({ cursor: null, hasMore: false });
    expect(data.pageParams).toEqual([undefined]);
    expect(data.pages.flatMap((page) => page.data)).toEqual(expect.arrayContaining([{ id: "a", bookmarkFolderId: "default" }, { id: "b", bookmarkFolderId: "default" }, { id: "all-only", bookmarkFolderId: "default" }]));
    expect(s.client.getQueryData<ReturnType<typeof page>>(s.key())!.pages[0].data.every((item) => item.bookmarkFolderId === "default")).toBe(true);
    expect(s.client.getQueryState(s.key("default"))?.isInvalidated).toBe(true);
    expect(s.client.getQueryData(queryKeys.bookmarks.folders(s.other))).toEqual([destination, custom]);
    for (const key of s.untouched) {
      expect(s.client.getQueryData(key)).toEqual(s.source);
      expect(s.client.getQueryState(key)?.isInvalidated).toBe(false);
    }
  });
  test(`${kind} 写入失败不修改缓存或失效查询`, async () => {
    const s = setup(kind);
    PATCH.mockResolvedValue({ error: { message: "重名" } });
    DELETE.mockResolvedValue({ error: { message: "删除失败" } });
    const { result } = renderHook(() => ({ rename: useRenameBookmarkFolder(kind, "viewer"), remove: useDeleteBookmarkFolder(kind, "viewer") }), { wrapper: s.wrapper });
    await act(async () => {
      await expect(result.current.rename.mutateAsync({ id: "custom", name: "名称" })).rejects.toEqual({ message: "重名" });
      await expect(result.current.remove.mutateAsync("custom")).rejects.toEqual({ message: "删除失败" });
    });
    expect(s.client.getQueryData(s.key("custom"))).toEqual(s.source);
    expect(s.client.getQueryData(queryKeys.bookmarks.folders(kind))).toEqual([destination, custom]);
    expect(s.invalidate).not.toHaveBeenCalled();
  });
}
