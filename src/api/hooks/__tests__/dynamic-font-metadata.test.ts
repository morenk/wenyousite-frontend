import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DynamicFontMetadata } from "@/api/dynamic-font-metadata";
import { FontMetadataError } from "../text-font-recovery";
import {
  dynamicFontState,
  rememberDynamicFont,
  type DynamicFontDescriptor,
} from "@/lib/dynamic-text-font-state";
import { parseDynamicFontPolicy } from "@/lib/dynamic-text-font-protocol";
import policy from "../../../../contracts/thread-font-runtime-policy-v3.json";
const id = (n: string) => "tfv_" + n.repeat(32);
function descriptor(n: string, revision: number): DynamicFontDescriptor {
  return {
    fontVersion: 2,
    versionId: id(n),
    familyId: "tff_" + n.repeat(32),
    versionNumber: 1,
    name: n,
    designLanguage: "en",
    revision,
    status: "published",
    selectable: true,
    pasteAllowed: true,
    renderAllowed: true,
    assetBasePath: `/api/v1/meta/text-fonts/v2/versions/${id(n)}/assets/`,
    manifest: { sha256: "a".repeat(64), bytes: 64, format: "json" },
    specimen: { sha256: "b".repeat(64), bytes: 64, format: "png" },
  };
}
const response = (data: DynamicFontDescriptor) => ({
  data,
  etag: '"' + data.versionId + '"',
  unchanged: false,
});
const releases: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T00:00:00Z"));
});
afterEach(() => {
  releases.splice(0).forEach((release) => release());
  vi.useRealTimers();
});
test("A/B版本响应乱序：B新修订先到不丢弃A的合法初次响应", async () => {
  let resolveA!: (value: ReturnType<typeof response>) => void;
  const fetch = vi.fn(async (version: string) =>
    version === id("1")
      ? new Promise<ReturnType<typeof response>>((resolve) => {
          resolveA = resolve;
        })
      : response(descriptor("2", 11)),
  );
  const metadata = new DynamicFontMetadata({
    descriptor: fetch,
    page: vi.fn(),
    policy: async () => parseDynamicFontPolicy(policy),
  });
  releases.push(
    metadata.watch(id("1"), vi.fn()),
    metadata.watch(id("2"), vi.fn()),
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(metadata.get(id("2"))?.revision).toBe(11);
  resolveA(response(descriptor("1", 10)));
  await vi.advanceTimersByTimeAsync(0);
  expect(metadata.get(id("1"))?.revision).toBe(10);
  expect(dynamicFontState(id("1"))?.renderAllowed).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
});
test("未知版本404到期后同页自动发现发布；重复前台事件不突破30秒负缓存", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new FontMetadataError(false, undefined, 404))
    .mockResolvedValue(response(descriptor("3", 20)));
  const listener = vi.fn();
  const metadata = new DynamicFontMetadata({
    descriptor: fetch,
    page: vi.fn(),
    policy: async () => parseDynamicFontPolicy(policy),
  });
  releases.push(metadata.watch(id("3"), listener));
  await vi.advanceTimersByTimeAsync(0);
  for (let n = 0; n < 20; n++) {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  }
  await vi.advanceTimersByTimeAsync(29999);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(metadata.get(id("3"))).toBeUndefined();
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(metadata.get(id("3"))?.renderAllowed).toBe(true);
  expect(listener).toHaveBeenCalledTimes(2);
});
test("同版本旧修订不能覆盖新状态，撤回墓碑优先于更晚响应", () => {
  const version = descriptor("4", 30);
  rememberDynamicFont({
    ...version,
    status: "disabled",
    selectable: false,
    pasteAllowed: false,
  });
  rememberDynamicFont({ ...version, revision: 29 });
  expect(dynamicFontState(version.versionId)?.pasteAllowed).toBe(false);
  rememberDynamicFont({
    ...version,
    status: "withdrawn",
    selectable: false,
    pasteAllowed: false,
    renderAllowed: false,
  });
  rememberDynamicFont({ ...version, revision: 31 });
  expect(dynamicFontState(version.versionId)?.status).toBe("withdrawn");
});

test.each(["304", "offline"])(
  "目录发布新版后旧版粘贴权限保留：描述符%s",
  async (mode) => {
    const old = descriptor("5", 100),
      next = descriptor("6", 101);
    const fetch = vi.fn().mockResolvedValueOnce(response(old));
    if (mode === "304")
      fetch.mockResolvedValue({ unchanged: true, etag: '"old"' });
    else fetch.mockRejectedValue(new TypeError("offline"));
    const item = {
      familyId: next.familyId,
      versionId: next.versionId,
      name: next.name,
      designLanguage: next.designLanguage,
      sortOrder: 0,
      selectable: true,
      pasteAllowed: true,
      renderAllowed: true,
      assetBasePath: next.assetBasePath!,
      specimen: next.specimen!,
    };
    const page = vi.fn().mockResolvedValue({
      data: {
        fontVersion: 2,
        releaseId: "tfc_" + "1".repeat(32),
        revision: 101,
        items: [item],
        nextCursor: null,
      },
      unchanged: false,
      etag: '"new"',
    });
    const metadata = new DynamicFontMetadata({
      descriptor: fetch,
      page,
      policy: async () => parseDynamicFontPolicy(policy),
    });
    releases.push(metadata.watch(old.versionId, vi.fn()));
    await vi.advanceTimersByTimeAsync(0);
    await metadata.catalog(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(0);
    expect(dynamicFontState(old.versionId)).toMatchObject({
      selectable: false,
      pasteAllowed: true,
      renderAllowed: true,
    });
    expect(metadata.get(old.versionId)).toMatchObject({
      pasteAllowed: true,
      renderAllowed: true,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  },
);
const catalogPage = (
  revision: number,
  versions: string[],
  nextCursor: string | null = null,
) => ({
  fontVersion: 2 as const,
  releaseId: "tfc_" + revision.toString(16).padStart(32, "0"),
  revision,
  items: versions.map((n) => {
    const d = descriptor(n, revision);
    return {
      familyId: d.familyId,
      versionId: d.versionId,
      name: d.name,
      designLanguage: d.designLanguage,
      sortOrder: 0,
      selectable: true as const,
      pasteAllowed: true as const,
      renderAllowed: true as const,
      assetBasePath: d.assetBasePath!,
      specimen: { ...d.specimen!, format: "png" as const },
    };
  }),
  nextCursor,
});
test("分页目录409时丢弃部分新页重读；并发查询合并且完整后才发布", async () => {
  let finish!: (value: unknown) => void;
  const page = vi
    .fn()
    .mockResolvedValueOnce({
      data: catalogPage(200, ["7"], "second"),
      etag: '"200"',
      unchanged: false,
    })
    .mockRejectedValueOnce(new FontMetadataError(true, undefined, 409))
    .mockResolvedValueOnce({
      data: catalogPage(201, ["8"], "second"),
      etag: '"201"',
      unchanged: false,
    })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const metadata = new DynamicFontMetadata({
    descriptor: vi.fn(),
    page,
    policy: async () => parseDynamicFontPolicy(policy),
  });
  const first = metadata.catalog(new AbortController().signal),
    second = metadata.catalog(new AbortController().signal);
  await vi.advanceTimersByTimeAsync(0);
  expect(page).toHaveBeenCalledTimes(4);
  expect(dynamicFontState(id("8"))).toBeUndefined();
  finish({ data: catalogPage(201, ["9"]), unchanged: false });
  const [a, b] = await Promise.all([first, second]);
  expect(a).toBe(b);
  expect(a.items.map((x) => x.versionId)).toEqual([id("8"), id("9")]);
  expect(dynamicFontState(id("7"))).toBeUndefined();
  expect(page.mock.calls[2]!.slice(0, 2)).toEqual([undefined, undefined]);
});
test("损坏新页不替换完整旧目录；304复用旧目录和ETag", async () => {
  const page = vi
    .fn()
    .mockResolvedValueOnce({
      data: catalogPage(210, ["a"]),
      etag: '"210"',
      unchanged: false,
    })
    .mockResolvedValueOnce({
      data: catalogPage(211, ["b"], "next"),
      etag: '"211"',
      unchanged: false,
    })
    .mockResolvedValueOnce({ data: catalogPage(211, ["b"]), unchanged: false })
    .mockResolvedValueOnce({ unchanged: true, etag: '"210"' });
  const metadata = new DynamicFontMetadata({
      descriptor: vi.fn(),
      page,
      policy: async () => parseDynamicFontPolicy(policy),
    }),
    signal = new AbortController().signal;
  const old = await metadata.catalog(signal);
  await expect(metadata.catalog(signal)).rejects.toThrow();
  expect(await metadata.catalog(signal)).toBe(old);
  expect(page.mock.calls.at(-1)![1]).toBe('"210"');
  expect(dynamicFontState(id("b"))).toBeUndefined();
});
test("闲置描述符LRU有界；重复watch合并请求且最后引用释放才取消", async () => {
  const fetch = vi.fn().mockResolvedValue({ unchanged: false });
  const metadata = new DynamicFontMetadata({
    descriptor: fetch,
    page: vi.fn(),
    policy: async () => parseDynamicFontPolicy(policy),
  });
  for (let n = 0; n < 150; n++) {
    const release = metadata.watch(
      "tfv_" + n.toString(16).padStart(32, "0"),
      vi.fn(),
    );
    await vi.advanceTimersByTimeAsync(0);
    release();
  }
  expect(metadata.snapshot.versions).toBeLessThanOrEqual(128);
  let signal: AbortSignal | undefined;
  fetch.mockImplementation((_id, _etag, requestSignal) => {
    signal = requestSignal;
    return new Promise(() => {});
  });
  const one = metadata.watch(id("c"), vi.fn()),
    two = metadata.watch(id("c"), vi.fn());
  releases.push(one, two);
  expect(metadata.snapshot.pending).toBe(1);
  one();
  expect(signal!.aborted).toBe(false);
  two();
  expect(signal!.aborted).toBe(true);
});
test("前台事件风暴不能绕过暂时失败的Retry-After，策略失败也只重试一次", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(
      new FontMetadataError(true, performance.now() + 10000, 503),
    )
    .mockResolvedValue(response(descriptor("d", 300)));
  const policyFetch = vi
    .fn()
    .mockResolvedValueOnce(parseDynamicFontPolicy(policy))
    .mockRejectedValue(
      new FontMetadataError(true, performance.now() + 1000000, 503),
    );
  const metadata = new DynamicFontMetadata({
    descriptor: fetch,
    page: vi.fn(),
    policy: policyFetch,
  });
  releases.push(metadata.watch(id("d"), vi.fn()));
  await vi.advanceTimersByTimeAsync(0);
  for (let n = 0; n < 100; n++) {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  }
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(10000);
  expect(fetch).toHaveBeenCalledTimes(2);
  const signal = new AbortController().signal,
    good = await metadata.policy(signal);
  await vi.advanceTimersByTimeAsync(300000);
  for (let n = 0; n < 100; n++)
    expect(await metadata.policy(signal)).toBe(good);
  expect(policyFetch).toHaveBeenCalledTimes(2);
});
test("最后需求取消后立即重订阅，不会卡在已取消的合并请求上", async () => {
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      (_id, _etag, signal: AbortSignal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () =>
            reject(new DOMException("released", "AbortError")),
          ),
        ),
    )
    .mockResolvedValue(response(descriptor("e", 400)));
  const metadata = new DynamicFontMetadata({
    descriptor: fetch,
    page: vi.fn(),
    policy: async () => parseDynamicFontPolicy(policy),
  });
  const release = metadata.watch(id("e"), vi.fn());
  release();
  releases.push(metadata.watch(id("e"), vi.fn()));
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(metadata.get(id("e"))?.renderAllowed).toBe(true);
});
test("512条总上限优先淘汰闲置记录；全部在用时不继续增长", async () => {
  const fetch = vi.fn(async (versionId: string) =>
    response({
      ...descriptor("a", 600),
      versionId,
      assetBasePath: `/api/v1/meta/text-fonts/v2/versions/${versionId}/assets/`,
    }),
  );
  const metadata = new DynamicFontMetadata({
      descriptor: fetch,
      page: vi.fn(),
      policy: async () => parseDynamicFontPolicy(policy),
    }),
    ids = Array.from(
      { length: 514 },
      (_, n) => "tfv_" + n.toString(16).padStart(32, "0"),
    );
  for (const versionId of ids.slice(0, 512))
    releases.push(metadata.watch(versionId, vi.fn()));
  await vi.advanceTimersByTimeAsync(0);
  expect(metadata.snapshot).toMatchObject({ versions: 512, active: 512 });
  const denied = metadata.watch(ids[512]!, vi.fn());
  denied();
  expect(fetch).toHaveBeenCalledTimes(512);
  releases.at(-512)!();
  releases.push(metadata.watch(ids[513]!, vi.fn()));
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(513);
  expect(metadata.snapshot).toMatchObject({ versions: 512, active: 512 });
  expect(metadata.get(ids[0]!)).toBeUndefined();
  expect(metadata.get(ids[513]!)).toBeDefined();
});
