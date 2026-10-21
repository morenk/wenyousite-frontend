import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  useAdminTextFontActions,
  useAdminTextFont,
  useAdminTextFonts,
  useAdminTextFontPreview,
} from "../admin/use-admin-text-fonts";
import { emptyTextFontConfiguration } from "@/lib/admin-text-font-form";
import { queryKeys } from "@/api/query-keys";
const api = vi.hoisted(() => ({ GET: vi.fn(), PATCH: vi.fn(), POST: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: api }));
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
beforeEach(() => {
  vi.resetAllMocks();
  for (const method of Object.values(api))
    method.mockResolvedValue({
      data: { data: { familyId: "family", jobs: [], versionIds: [] } },
    });
});
afterEach(cleanup);
test.each([
  "create",
  "update",
  "upload",
  "process",
  "publish",
  "enabled",
  "withdraw",
] as const)(
  "%s成功后失效字体、审计和公开目录；失败保留缓存",
  async (action) => {
    const { client, wrapper } = setup(),
      invalidate = vi
        .spyOn(client, "invalidateQueries")
        .mockResolvedValue(undefined),
      hook = renderHook(() => useAdminTextFontActions(), { wrapper });
    const file = new File([new Uint8Array([0, 1, 2, 3])], "font.ttf");
    const args = {
      create: emptyTextFontConfiguration,
      update: {
        ...emptyTextFontConfiguration,
        familyId: "family",
        expectedFamilyRevision: 3,
      },
      upload: {
        familyId: "family",
        file,
        format: "ttf" as const,
        expectedFamilyRevision: 3,
      },
      process: "job",
      publish: {
        familyId: "family",
        versionId: "version",
        expectedFamilyRevision: 3,
        expectedCatalogRevision: 5,
      },
      enabled: {
        familyId: "family",
        enabled: false,
        expectedFamilyRevision: 3,
        expectedCatalogRevision: 5,
      },
      withdraw: {
        versionId: "version",
        expectedCatalogRevision: 5,
        reason: "无授权",
      },
    };
    const call = () => {
      switch (action) {
        case "create":
          return hook.result.current.create.mutateAsync(args.create);
        case "update":
          return hook.result.current.update.mutateAsync(args.update);
        case "upload":
          return hook.result.current.upload.mutateAsync(args.upload);
        case "process":
          return hook.result.current.process.mutateAsync(args.process);
        case "publish":
          return hook.result.current.publish.mutateAsync(args.publish);
        case "enabled":
          return hook.result.current.enabled.mutateAsync(args.enabled);
        case "withdraw":
          return hook.result.current.withdraw.mutateAsync(args.withdraw);
      }
    };
    await call();
    expect(invalidate.mock.calls.map(([filter]) => filter?.queryKey)).toEqual(
      expect.arrayContaining([
        queryKeys.admin.textFontsRoot,
        queryKeys.admin.auditsRoot,
        queryKeys.dynamicFonts.catalog,
      ]),
    );
    const method =
      action === "update" || action === "enabled" ? api.PATCH : api.POST;
    if (action === "upload") {
      const options = method.mock.calls[0]![1];
      expect(options.headers).toEqual({
        "Content-Type": "application/octet-stream",
      });
      expect(options.bodySerializer()).toBe(file);
      expect(options.params.query).toEqual({
        format: "ttf",
        expectedFamilyRevision: 3,
      });
    }
    if (action === "publish" || action === "enabled")
      expect(method.mock.calls[0]![1].body).toMatchObject({
        expectedFamilyRevision: 3,
        expectedCatalogRevision: 5,
      });
    invalidate.mockClear();
    method.mockResolvedValueOnce({
      error: { code: 40928, message: "changed" },
    });
    await expect(call()).rejects.toMatchObject({ code: 40928 });
    expect(invalidate).not.toHaveBeenCalled();
  },
);
test("列表游标与详情/预览分开缓存，缺ID不请求", async () => {
  const { wrapper } = setup();
  const empty = renderHook(
    () => ({ detail: useAdminTextFont(), preview: useAdminTextFontPreview() }),
    { wrapper },
  );
  expect(api.GET).not.toHaveBeenCalled();
  empty.unmount();
  const list = renderHook(() => useAdminTextFonts("after"), { wrapper });
  await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
  expect(api.GET).toHaveBeenCalledWith(
    "/api/v1/admin/text-fonts",
    expect.objectContaining({
      params: { query: { limit: 20, after: "after" } },
    }),
  );
  const detail = renderHook(() => useAdminTextFont("family"), { wrapper }),
    preview = renderHook(() => useAdminTextFontPreview("version"), { wrapper });
  await waitFor(() =>
    expect(
      detail.result.current.isSuccess && preview.result.current.isSuccess,
    ).toBe(true),
  );
  expect(api.GET).toHaveBeenCalledTimes(3);
});
test.each(["list", "detail", "preview"])(
  "%s查询失败不会伪造空结果",
  async (kind) => {
    api.GET.mockResolvedValue({ error: { code: 50301 } });
    const { wrapper } = setup();
    const hook = renderHook(
      () => ({
        list: useAdminTextFonts(),
        detail: useAdminTextFont("family"),
        preview: useAdminTextFontPreview("version"),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(
        hook.result.current[kind as "list" | "detail" | "preview"].isError,
      ).toBe(true),
    );
    expect(
      hook.result.current[kind as "list" | "detail" | "preview"].data,
    ).toBeUndefined();
  },
);
