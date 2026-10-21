import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { useDynamicTextFonts } from "../use-dynamic-text-fonts";
import {
  rememberDynamicFont,
  rememberDynamicFontCatalog,
} from "@/lib/dynamic-text-font-state";
import type { DynamicFontPage } from "@/api/text-font-dynamic-transport";
const fetch = vi.hoisted(() => vi.fn());
vi.mock("@/api/dynamic-font-metadata", () => ({
  dynamicFontMetadata: { catalog: fetch },
}));
afterEach(cleanup);
test("选择器已打开时版本被停用或撤回，立即移除旧目录里的候选", async () => {
  const versionId = "tfv_" + "f".repeat(32),
    item = {
      versionId,
      familyId: "tff_" + "f".repeat(32),
      name: "测试",
      designLanguage: "zh" as const,
      sortOrder: 0,
      selectable: true as const,
      pasteAllowed: true as const,
      renderAllowed: true as const,
      assetBasePath: `/api/v1/meta/text-fonts/v2/versions/${versionId}/assets/`,
      specimen: { sha256: "a".repeat(64), bytes: 100, format: "png" as const },
    };
  const data: DynamicFontPage = {
    fontVersion: 2,
    releaseId: "tfc_" + "e".repeat(32),
    revision: 900,
    items: [item],
    nextCursor: null,
  };
  rememberDynamicFontCatalog([item], 900);
  fetch.mockResolvedValue(data);
  const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    }),
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  const { result } = renderHook(() => useDynamicTextFonts(true), { wrapper });
  await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
  act(() =>
    rememberDynamicFont({
      versionId,
      revision: 901,
      status: "disabled",
      selectable: false,
      pasteAllowed: false,
      renderAllowed: true,
    }),
  );
  expect(result.current.data?.items).toHaveLength(0);
  act(() =>
    rememberDynamicFont({
      versionId,
      revision: 902,
      status: "published",
      selectable: true,
      pasteAllowed: true,
      renderAllowed: true,
    }),
  );
  expect(result.current.data?.items).toHaveLength(1);
  act(() =>
    rememberDynamicFont({
      versionId,
      revision: 903,
      status: "withdrawn",
      selectable: false,
      pasteAllowed: false,
      renderAllowed: false,
    }),
  );
  expect(result.current.data?.items).toHaveLength(0);
  await act(async () => {
    await result.current.refetch();
  });
  expect(result.current.data?.items).toHaveLength(0);
  expect(fetch).toHaveBeenCalledTimes(2);
  client.clear();
});
