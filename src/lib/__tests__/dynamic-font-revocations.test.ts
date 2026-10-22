import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DynamicFontDescriptor } from "../dynamic-text-font-state";
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: { GET: api.get } }));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  api.get.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});
const id = (n: number) => "tfv_" + n.toString(16).padStart(32, "0");
function descriptor(versionId: string): DynamicFontDescriptor {
  return {
    fontVersion: 2,
    versionId,
    familyId: "tff_" + "a".repeat(32),
    versionNumber: 1,
    revision: 1,
    name: "构建后新增",
    designLanguage: "en",
    status: "published",
    selectable: true,
    pasteAllowed: true,
    renderAllowed: true,
    assetBasePath: `/api/v1/meta/text-fonts/v2/versions/${versionId}/assets/`,
    manifest: { sha256: "a".repeat(64), bytes: 32, format: "json" },
    specimen: { sha256: "b".repeat(64), bytes: 32, format: "png" },
  };
}
const response = (data: DynamicFontDescriptor) => ({
  data,
  etag: undefined,
  unchanged: false,
});

test("任意新ID撤回后两层LRU淘汰、旧目录、迟到描述符和离线恢复均不能重新授权或下载", async () => {
  const { DynamicFontMetadata } = await import("@/api/dynamic-font-metadata");
  const { dynamicFontState } = await import("../dynamic-text-font-state");
  const { isPasteAllowedTextFont, isSelectableTextFont } =
    await import("../markdown-text-font");
  const { DynamicTextFontRuntime } =
    await import("../dynamic-text-font-runtime");
  const original = descriptor(id(9000));
  const item: import("@/api/text-font-dynamic-transport").DynamicFontPage["items"][number] =
    {
      familyId: original.familyId,
      versionId: original.versionId,
      name: original.name,
      designLanguage: original.designLanguage,
      sortOrder: 0,
      selectable: true,
      pasteAllowed: true,
      renderAllowed: true,
      assetBasePath: original.assetBasePath!,
      specimen: original.specimen!,
    };
  const fetch = vi.fn(async (version: string) => response(descriptor(version)));
  const page = vi.fn(async () => ({
    data: {
      fontVersion: 2,
      releaseId: "tfc_" + "c".repeat(32),
      revision: 100,
      items: [item],
      nextCursor: null,
    } satisfies import("@/api/text-font-dynamic-transport").DynamicFontPage,
    etag: undefined,
    unchanged: false,
  }));
  const metadata = new DynamicFontMetadata({
    descriptor: fetch,
    page,
    policy: vi.fn(),
  });
  let late!: (value: ReturnType<typeof response>) => void;
  const lagging = new DynamicFontMetadata({
    descriptor: () =>
      new Promise((resolve) => {
        late = resolve;
      }),
    page: vi.fn(),
    policy: vi.fn(),
  });
  const release = metadata.watch(original.versionId, vi.fn());
  const releaseLate = lagging.watch(original.versionId, vi.fn());
  await vi.advanceTimersByTimeAsync(0);
  metadata.withdraw(original.versionId);
  release();
  for (let n = 1; n <= 530; n++) {
    const stop = metadata.watch(id(n), vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    stop();
  }
  expect(metadata.get(original.versionId)).toBeUndefined();
  expect(metadata.snapshot.versions).toBeLessThanOrEqual(128);
  late(response({ ...original, revision: 999 }));
  await vi.advanceTimersByTimeAsync(0);
  expect(lagging.get(original.versionId)).toBeUndefined();
  await metadata.catalog(new AbortController().signal);
  expect(dynamicFontState(original.versionId)?.status).toBe("withdrawn");
  expect(isSelectableTextFont(original.versionId)).toBe(false);
  expect(isPasteAllowedTextFont(original.versionId)).toBe(false);
  fetch.mockClear().mockRejectedValue(new TypeError("offline"));
  const stop = metadata.watch(original.versionId, vi.fn());
  window.dispatchEvent(new Event("online"));
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(300001);
  expect(fetch).not.toHaveBeenCalled();
  expect(metadata.assetsAvailable(original.versionId)).toBe(false);
  const runtime = new DynamicTextFontRuntime(),
    emit = vi.fn();
  const stopRuntime = runtime.watch(original.versionId, "Aa", emit);
  expect(emit).toHaveBeenLastCalledWith({
    family: "var(--wenyou-font-body-family, system-ui)",
    status: "fallback",
  });
  expect(api.get).not.toHaveBeenCalled();
  expect(runtime.snapshot.demands).toBe(0);
  stopRuntime();
  runtime.dispose();
  stop();
  releaseLate();
});

test("4096个撤回ID为硬上限，溢出后既有和未知版本均安全回退，旧目录不能解除", async () => {
  const { MAX_FONT_REVOCATIONS, fontRevocationSnapshot } =
    await import("../dynamic-font-revocations");
  const { rememberDynamicFont, rememberDynamicFontCatalog, dynamicFontState } =
    await import("../dynamic-text-font-state");
  const { isSelectableTextFont, isPasteAllowedTextFont } =
    await import("../markdown-text-font");
  const { DynamicFontMetadata } = await import("@/api/dynamic-font-metadata");
  const active = descriptor(id(9999));
  rememberDynamicFont(active);
  for (let n = 0; n <= MAX_FONT_REVOCATIONS; n++)
    rememberDynamicFont({
      ...active,
      versionId: id(n),
      status: "withdrawn",
      selectable: false,
      pasteAllowed: false,
      renderAllowed: false,
    });
  expect(fontRevocationSnapshot()).toEqual({ versions: 4096, denyAll: true });
  rememberDynamicFontCatalog([active, descriptor(id(9998))], 999);
  for (const version of [id(0), id(4096), active.versionId, id(9998)]) {
    expect(dynamicFontState(version)?.renderAllowed).toBe(false);
    expect(isSelectableTextFont(version)).toBe(false);
    expect(isPasteAllowedTextFont(version)).toBe(false);
  }
  const fetch = vi.fn(),
    metadata = new DynamicFontMetadata({
      descriptor: fetch,
      page: vi.fn(),
      policy: vi.fn(),
    });
  const release = metadata.watch(active.versionId, vi.fn());
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).not.toHaveBeenCalled();
  release();
});
