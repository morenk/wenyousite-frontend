import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DynamicTextFontRuntime } from "../dynamic-text-font-runtime";
import { FontResidency } from "../thread-font-residency";
import { FontDownloadScheduler } from "../thread-font-scheduler";
import {
  parseDynamicFontPolicy,
  type DynamicFontAsset,
} from "../dynamic-text-font-protocol";
import type { DynamicFontDescriptor } from "../dynamic-text-font-state";
import policy from "../../../contracts/thread-font-runtime-policy-v3.json";
const env = vi.hoisted(() => ({
  values: new Map<string, DynamicFontDescriptor>(),
  unavailable: new Set<string>(),
  cache: new Map<string, ArrayBuffer>(),
  listeners: new Map<string, Set<() => void>>(),
  transport: vi.fn<typeof fetch>(),
  install: vi.fn(),
  policy: vi.fn(),
  residency: undefined as unknown as FontResidency,
  scheduler: undefined as unknown as FontDownloadScheduler,
}));
vi.mock("@/api/dynamic-font-metadata", () => ({
  dynamicFontMetadata: {
    assetsAvailable: (id: string) => !env.unavailable.has(id),
    get: (id: string) => env.values.get(id),
    policy: (...args: unknown[]) => env.policy(...args),
    watch: (id: string, cb: () => void) => {
      const listeners = env.listeners.get(id) ?? new Set();
      listeners.add(cb);
      env.listeners.set(id, listeners);
      return () => listeners.delete(cb);
    },
    withdraw: (id: string) => {
      const value = env.values.get(id);
      if (value) {
        env.values.set(id, {
          ...value,
          status: "withdrawn",
          renderAllowed: false,
          pasteAllowed: false,
          selectable: false,
          assetBasePath: null,
          manifest: null,
          specimen: null,
        });
        for (const cb of env.listeners.get(id) ?? []) cb();
      }
    },
  },
}));
vi.mock("@/api/text-font-dynamic-transport", () => ({
  dynamicFontAssetTransport: (...args: Parameters<typeof fetch>) =>
    env.transport(...args),
}));
vi.mock("../thread-font-shared-residency", () => ({
  sharedFontResidency: () => env.residency,
  onFontCapacityAvailable: () => () => {},
}));
vi.mock("../thread-font-network", () => ({
  threadFontNetwork: () => env.scheduler,
}));
vi.mock("../thread-font-cache", () => ({
  sharedThreadFontCache: () =>
    new (class {
      async get(key: string) {
        return env.cache.get(key) ?? null;
      }
      async put(key: string, value: ArrayBuffer) {
        env.cache.set(key, value);
      }
      async delete(key: string) {
        env.cache.delete(key);
      }
    })(),
}));
vi.mock("../thread-font-binary", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  installThreadFontFace: (...args: unknown[]) => env.install(...args),
}));
const runtimes: DynamicTextFontRuntime[] = [];
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  env.policy.mockReset().mockResolvedValue(parseDynamicFontPolicy(policy));
  env.values.clear();
  env.unavailable.clear();
  env.cache.clear();
  env.listeners.clear();
  env.transport.mockReset();
  env.install.mockReset().mockResolvedValue(vi.fn());
  env.residency = new FontResidency({
    families: Number.MAX_SAFE_INTEGER,
    faces: 64,
    bytes: 16777216,
    originalBytes: 0,
  });
  env.scheduler = new FontDownloadScheduler({
    concurrency: 2,
    windowMs: 60000,
    requestsPerWindow: 64,
    bytesPerWindow: 16777216,
    originalBytesPerWindow: 0,
  });
});
afterEach(() => {
  runtimes.splice(0).forEach((runtime) => runtime.dispose());
  env.residency.invalidate();
  vi.unstubAllGlobals();
});
async function fixture() {
  const assets = new Map<string, ArrayBuffer>();
  const add = async (
    bytes: ArrayBuffer,
    format: DynamicFontAsset["format"],
  ): Promise<DynamicFontAsset> => {
    const sha256 = Buffer.from(
      await webcrypto.subtle.digest("SHA-256", bytes),
    ).toString("hex");
    assets.set(sha256 + "." + format, bytes);
    return { sha256, bytes: bytes.byteLength, format };
  };
  const json = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer;
  const font = (salt: number) => {
    const bytes = new ArrayBuffer(48);
    const view = new DataView(bytes);
    view.setUint32(0, 0x774f4632);
    view.setUint32(8, 48);
    view.setUint32(16, 64);
    view.setUint32(44, salt);
    return bytes;
  };
  const shards = await Promise.all(
    ["0041", "0042"].map(async (range, i) => ({
      id: "part" + i,
      family: "WYF2-" + "a".repeat(32) + "-part" + i,
      unicodeRanges: ["U+" + range],
      codepointCount: 1,
      web: await add(font(i), "woff2"),
      mobile: { sha256: "b".repeat(64), bytes: 64, format: "ttf" },
    })),
  );
  const notice = await add(json({ license: "test" }), "json"),
    specimen = await add(new Uint8Array([1, 2, 3]).buffer, "png");
  const manifest = await add(
    json({
      manifestVersion: 2,
      buildKey: "c".repeat(64),
      sourceSha256: "d".repeat(64),
      baseWeight: 400,
      baseStyle: "normal",
      coverage: { codepointCount: 2, unicodeRanges: ["U+0041-0042"] },
      shards,
      notices: [notice],
      specimen,
    }),
    "json",
  );
  const descriptor = (n: string): DynamicFontDescriptor => ({
    fontVersion: 2,
    versionId: "tfv_" + n.repeat(32),
    familyId: "tff_" + n.repeat(32),
    versionNumber: 1,
    name: n,
    designLanguage: "en",
    revision: 1,
    status: "published",
    selectable: true,
    pasteAllowed: true,
    renderAllowed: true,
    assetBasePath: `/api/v1/meta/text-fonts/v2/versions/tfv_${n.repeat(32)}/assets/`,
    manifest,
    specimen,
  });
  const first = descriptor("1"),
    second = descriptor("2");
  env.values.set(first.versionId, first);
  env.values.set(second.versionId, second);
  const transport = async (input: Parameters<typeof fetch>[0]) =>
    new Response(assets.get(String(input).split("/").at(-1)!)!, {
      headers: {
        "content-type": String(input).endsWith("woff2")
          ? "font/woff2"
          : "application/json",
      },
    });
  env.transport.mockImplementation(transport);
  const runtime = new DynamicTextFontRuntime();
  runtimes.push(runtime);
  return { runtime, first, second, shards, transport, assets };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 15));
test.each(["preview", "published", "disabled"] as const)(
  "后台%s样张始终走认证网关，不依赖公共描述符或读写磁盘缓存",
  async (status) => {
    const f = await fixture();
    const descriptor = {
      ...f.first,
      status,
      selectable: status === "published",
      pasteAllowed: status === "published",
      assetBasePath: `/api/v1/admin/text-fonts/versions/${f.first.versionId}/assets/`,
    };
    env.unavailable.add(descriptor.versionId);
    env.values.delete(descriptor.versionId);
    const asset = descriptor.specimen!;
    const bytes = f.assets.get(asset.sha256 + ".png")!;
    env.transport.mockImplementation(async () =>
      new Response(bytes, {
        headers: { "content-type": "image/png" },
      }),
    );
    await expect(
      f.runtime.specimen(descriptor, new AbortController().signal),
    ).resolves.toEqual(bytes);
    expect(env.cache.has(asset.sha256)).toBe(false);
    // 即便磁盘已有相同 SHA，也必须重新经过管理员认证网关。
    env.cache.set(asset.sha256, bytes);
    await expect(
      f.runtime.specimen(descriptor, new AbortController().signal),
    ).resolves.toEqual(bytes);
    expect(env.transport).toHaveBeenCalledTimes(2);
    expect(String(env.transport.mock.calls[0]![0])).toContain(
      descriptor.assetBasePath,
    );
    expect(env.install).not.toHaveBeenCalled();
  },
);
test("相同版本的两个可见需求共享下载；先释放者不会取消仍有引用的安装", async () => {
  const f = await fixture();
  let unblock!: () => void;
  let started = false;
  let downloadSignal: AbortSignal | undefined;
  env.transport.mockImplementation(async (input, init) => {
    if (String(input).endsWith(f.shards[0]!.web.sha256 + ".woff2")) {
      started = true;
      downloadSignal = init?.signal ?? undefined;
      await new Promise<void>((resolve) => {
        unblock = resolve;
      });
    }
    return f.transport(input);
  });
  const first = vi.fn(),
    second = vi.fn();
  const release = f.runtime.watch(f.first.versionId, "A", first);
  f.runtime.watch(f.first.versionId, "A", second);
  await vi.waitFor(() => expect(started).toBe(true));
  release();
  expect(downloadSignal?.aborted).toBe(false);
  unblock();
  await vi.waitFor(() =>
    expect(second).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready" }),
    ),
  );
  expect(env.install).toHaveBeenCalledTimes(1);
  expect(f.runtime.snapshot.residency.references).toBe(1);
});
test("已显示部分字体时撤回：立即回退、取消后续分片，迟到结果不恢复", async () => {
  const f = await fixture(),
    shown = vi.fn();
  f.runtime.watch(f.first.versionId, "A", shown);
  await vi.waitFor(() =>
    expect(shown).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready" }),
    ),
  );
  let unblock!: () => void;
  let downloadSignal: AbortSignal | undefined;
  env.transport.mockImplementation(async (input, init) => {
    if (String(input).endsWith(f.shards[1]!.web.sha256 + ".woff2")) {
      downloadSignal = init?.signal ?? undefined;
      await new Promise<void>((resolve) => {
        unblock = resolve;
      });
    }
    return f.transport(input);
  });
  const next = vi.fn();
  f.runtime.watch(f.first.versionId, "AB", next);
  await vi.waitFor(() => expect(downloadSignal).toBeDefined());
  const { dynamicFontMetadata } = await import("@/api/dynamic-font-metadata");
  dynamicFontMetadata.withdraw(f.first.versionId);
  expect(shown).toHaveBeenLastCalledWith({
    family: "var(--wenyou-font-body-family, system-ui)",
    status: "fallback",
  });
  expect(downloadSignal!.aborted).toBe(true);
  unblock();
  await flush();
  expect(env.install).toHaveBeenCalledTimes(1);
  expect(f.runtime.snapshot.demands).toBe(0);
  expect(next).toHaveBeenLastCalledWith({
    family: "var(--wenyou-font-body-family, system-ui)",
    status: "fallback",
  });
});
test("撤回首个版本不取消其他合法版本共享的同SHA和family传输", async () => {
  const f = await fixture();
  let unblock!: () => void;
  let signal: AbortSignal | undefined;
  env.transport.mockImplementation(async (input, init) => {
    if (String(input).endsWith(f.shards[0]!.web.sha256 + ".woff2")) {
      signal = init?.signal ?? undefined;
      await new Promise<void>((resolve) => {
        unblock = resolve;
      });
    }
    return f.transport(input);
  });
  f.runtime.watch(f.first.versionId, "A", vi.fn());
  const second = vi.fn();
  f.runtime.watch(f.second.versionId, "A", second);
  await vi.waitFor(() =>
    expect(f.runtime.snapshot.residency.references).toBe(2),
  );
  await vi.waitFor(() => expect(signal).toBeDefined());
  const { dynamicFontMetadata } = await import("@/api/dynamic-font-metadata");
  dynamicFontMetadata.withdraw(f.first.versionId);
  expect(signal!.aborted).toBe(false);
  unblock();
  await vi.waitFor(() =>
    expect(second).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready" }),
    ),
  );
  expect(env.install).toHaveBeenCalledTimes(1);
  expect(f.runtime.snapshot.residency).toMatchObject({
    faces: 1,
    bytes: 64,
    references: 1,
  });
});
test.each(["manifest", "notice"])(
  "撤回时取消在途%s，迟到合法数据不能注册",
  async (phase) => {
    const f = await fixture();
    let signal: AbortSignal | undefined, unblock!: () => void;
    env.transport.mockImplementation(async (input, init) => {
      const isManifest = String(input).endsWith(
        f.first.manifest!.sha256 + ".json",
      );
      if (
        (phase === "manifest" && isManifest) ||
        (phase === "notice" && !isManifest && String(input).endsWith(".json"))
      ) {
        signal = init?.signal ?? undefined;
        await new Promise<void>((resolve) => {
          unblock = resolve;
        });
      }
      return f.transport(input);
    });
    const report = vi.fn();
    f.runtime.watch(f.first.versionId, "A", report);
    await vi.waitFor(() => expect(signal).toBeDefined());
    const { dynamicFontMetadata } = await import("@/api/dynamic-font-metadata");
    dynamicFontMetadata.withdraw(f.first.versionId);
    expect(signal!.aborted).toBe(true);
    unblock();
    await flush();
    expect(env.install).not.toHaveBeenCalled();
    expect(report).toHaveBeenLastCalledWith({
      family: "var(--wenyou-font-body-family, system-ui)",
      status: "fallback",
    });
    expect(f.runtime.snapshot.demands).toBe(0);
  },
);
test("同一版本不同段落的分片合并呈现；新增需求不抹去已显示分片", async () => {
  const f = await fixture(),
    first = vi.fn(),
    second = vi.fn();
  f.runtime.watch(f.first.versionId, "A", first);
  await vi.waitFor(() =>
    expect(first).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready" }),
    ),
  );
  f.runtime.watch(f.first.versionId, "B", second);
  expect(second).toHaveBeenLastCalledWith(
    expect.objectContaining({
      family: expect.stringContaining(f.shards[0]!.family),
      status: "loading",
    }),
  );
  await vi.waitFor(() =>
    expect(second).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready" }),
    ),
  );
  for (const report of [first, second]) {
    expect(report.mock.lastCall![0].family).toContain(f.shards[0]!.family);
    expect(report.mock.lastCall![0].family).toContain(f.shards[1]!.family);
  }
  expect(env.install).toHaveBeenCalledTimes(2);
});

test("大量不可变版本不会累积无界清单；闲置LRU限制128份", async () => {
  const f = await fixture();
  for (const [path, bytes] of f.assets)
    env.cache.set(path.split(".")[0]!, bytes);
  const original = JSON.parse(
    new TextDecoder().decode(f.assets.get(f.first.manifest!.sha256 + ".json")),
  );
  for (let n = 0; n < 132; n++) {
    const versionId = "tfv_" + n.toString(16).padStart(32, "0"),
      bytes = new TextEncoder().encode(
        JSON.stringify({
          ...original,
          buildKey: n.toString(16).padStart(64, "0"),
        }),
      ).buffer;
    const sha256 = Buffer.from(
      await webcrypto.subtle.digest("SHA-256", bytes),
    ).toString("hex");
    env.cache.set(sha256, bytes);
    env.values.set(versionId, {
      ...f.first,
      versionId,
      assetBasePath: `/api/v1/meta/text-fonts/v2/versions/${versionId}/assets/`,
      manifest: { sha256, bytes: bytes.byteLength, format: "json" },
    });
    let done!: () => void;
    const ready = new Promise<void>((resolve) => {
      done = resolve;
    });
    const release = f.runtime.watch(versionId, "Z", (value) => {
      if (value.status === "fallback") done();
    });
    await ready;
    release();
    expect(f.runtime.snapshot.manifests).toBeLessThanOrEqual(128);
  }
  expect(f.runtime.snapshot.manifests).toBe(128);
  expect(f.runtime.snapshot.manifestBytes).toBeLessThanOrEqual(16777216);
  expect(env.transport).not.toHaveBeenCalled();
});
test("FontFace解码进行中撤回，迟到安装句柄立即释放", async () => {
  const f = await fixture(),
    dispose = vi.fn();
  let complete!: (value: () => void) => void;
  env.install.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const report = vi.fn();
  f.runtime.watch(f.first.versionId, "A", report);
  await vi.waitFor(() => expect(env.install).toHaveBeenCalledTimes(1));
  const { dynamicFontMetadata } = await import("@/api/dynamic-font-metadata");
  dynamicFontMetadata.withdraw(f.first.versionId);
  complete(dispose);
  await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
  expect(f.runtime.snapshot.residency.faces).toBe(0);
  expect(report).toHaveBeenLastCalledWith({
    family: "var(--wenyou-font-body-family, system-ui)",
    status: "fallback",
  });
});
test("解码失败按版本资产隔离；同页重新进入不再尝试同一损坏字形", async () => {
  const f = await fixture();
  env.install.mockRejectedValue(new Error("font decode failed"));
  const first = vi.fn();
  const release = f.runtime.watch(f.first.versionId, "A", first);
  await vi.waitFor(() =>
    expect(first).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "fallback" }),
    ),
  );
  expect(env.install).toHaveBeenCalledTimes(1);
  release();
  const second = vi.fn();
  f.runtime.watch(f.first.versionId, "A", second);
  await vi.waitFor(() =>
    expect(second).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "fallback" }),
    ),
  );
  expect(env.install).toHaveBeenCalledTimes(1);
  expect(f.runtime.snapshot.residency.faces).toBe(0);
});
test("共享下载原版本返回410时，合法别名立即改用自己的网关继续", async () => {
  const f = await fixture();
  let releaseFirst!: () => void;
  env.transport.mockImplementation(async (input) => {
    if (
      String(input).includes(f.first.versionId) &&
      String(input).endsWith(f.shards[0]!.web.sha256 + ".woff2")
    ) {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      return new Response(null, { status: 410 });
    }
    return f.transport(input);
  });
  const first = vi.fn(),
    second = vi.fn();
  f.runtime.watch(f.first.versionId, "A", first);
  f.runtime.watch(f.second.versionId, "A", second);
  await vi.waitFor(() =>
    expect(f.runtime.snapshot.residency.references).toBe(2),
  );
  await vi.waitFor(() => expect(releaseFirst).toBeDefined());
  releaseFirst();
  await vi.waitFor(() =>
    expect(second).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready" }),
    ),
  );
  expect(first).toHaveBeenLastCalledWith({
    family: "var(--wenyou-font-body-family, system-ui)",
    status: "fallback",
  });
  expect(env.install).toHaveBeenCalledTimes(1);
  expect(
    env.transport.mock.calls.some(
      ([input]) =>
        String(input).includes(f.second.versionId) &&
        String(input).endsWith(".woff2"),
    ),
  ).toBe(true);
});

test("描述符暂时失败保留已装字体，缺失缓存不下载，恢复后同页补齐", async () => {
  const f = await fixture();
  const emit = vi.fn();
  f.runtime.watch(f.first.versionId, "A", emit);
  await vi.waitFor(() =>
    expect(emit).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready" }),
    ),
  );
  const requests = env.transport.mock.calls.length;
  env.unavailable.add(f.first.versionId);
  const missing = vi.fn();
  f.runtime.watch(f.first.versionId, "B", missing);
  await vi.waitFor(() =>
    expect(missing).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "fallback" }),
    ),
  );
  expect(env.transport).toHaveBeenCalledTimes(requests);
  expect(emit.mock.calls.at(-1)![0].family).toContain(f.shards[0]!.family);
  env.unavailable.delete(f.first.versionId);
  for (const cb of env.listeners.get(f.first.versionId)!) cb();
  await vi.waitFor(() =>
    expect(missing).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready" }),
    ),
  );
  expect(env.transport).toHaveBeenCalledTimes(requests + 1);
});

test("独立撤回账本立即移除已加载版本，但合法同资产别名保持呈现", async () => {
  const { rememberDynamicFont } = await import("../dynamic-text-font-state");
  const f = await fixture(),
    versionId = "tfv_" + "e".repeat(32);
  const version = {
    ...f.first,
    versionId,
    assetBasePath: `/api/v1/meta/text-fonts/v2/versions/${versionId}/assets/`,
  };
  env.values.set(versionId, version);
  const revoked = vi.fn(),
    legal = vi.fn();
  f.runtime.watch(versionId, "A", revoked);
  f.runtime.watch(f.second.versionId, "A", legal);
  await vi.waitFor(() =>
    expect(legal).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready" }),
    ),
  );
  await vi.waitFor(() =>
    expect(revoked).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready" }),
    ),
  );
  const requests = env.transport.mock.calls.length;
  rememberDynamicFont({
    ...version,
    status: "withdrawn",
    selectable: false,
    pasteAllowed: false,
    renderAllowed: false,
  });
  expect(revoked).toHaveBeenLastCalledWith({
    family: "var(--wenyou-font-body-family, system-ui)",
    status: "fallback",
  });
  expect(legal.mock.calls.at(-1)![0].family).toContain(f.shards[0]!.family);
  expect(f.runtime.snapshot.residency.references).toBe(1);
  for (let n = 0; n < 530; n++)
    rememberDynamicFont({
      ...version,
      versionId: "tfv_" + n.toString(16).padStart(32, "0"),
      revision: 20,
    });
  rememberDynamicFont({ ...version, revision: 30 });
  const again = vi.fn();
  f.runtime.watch(versionId, "A", again);
  expect(again).toHaveBeenLastCalledWith({
    family: "var(--wenyou-font-body-family, system-ui)",
    status: "fallback",
  });
  expect(env.transport).toHaveBeenCalledTimes(requests);
  expect(env.install).toHaveBeenCalledTimes(1);
});

test("作者进度按编辑scope与实际needed分片隔离，不广播chunk为正文状态", async () => {
  const f = await fixture(), scope = Symbol("author"), progress = vi.fn(), shown = vi.fn();
  const streams = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
  f.runtime.subscribeDownload(f.first.versionId, scope, progress);
  env.transport.mockImplementation(async input => {
    const key = String(input).split("/").at(-1)!;
    if (!key.endsWith("woff2")) return f.transport(input);
    return new Response(new ReadableStream<Uint8Array>({ start: controller => { streams.set(key, controller); } }), { headers: { "content-type": "font/woff2" } });
  });
  f.runtime.watch(f.first.versionId, "A", shown, scope);
  f.runtime.watch(f.first.versionId, "B", vi.fn()); // 同字体旁路阅读，不能计入作者分片。
  await vi.waitFor(() => expect(streams.size).toBe(2));
  const total = f.first.manifest!.bytes + [...f.assets].filter(([key]) => key.endsWith("json") && !key.startsWith(f.first.manifest!.sha256)).reduce((sum, [, bytes]) => sum + bytes.byteLength, 0) + 48;
  expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({totalBytes:total,status:"loading"}));
  const beforeChunks = shown.mock.calls.length;
  const a = f.shards[0]!.web.sha256 + ".woff2", other = f.shards[1]!.web.sha256 + ".woff2";
  streams.get(a)!.enqueue(new Uint8Array(f.assets.get(a)!).slice(0,12)); await flush();
  const authorBytes = progress.mock.calls.at(-1)![0].receivedBytes;
  streams.get(other)!.enqueue(new Uint8Array(f.assets.get(other)!).slice(0,24)); await flush();
  expect(progress.mock.calls.at(-1)![0].receivedBytes).toBe(authorBytes);
  expect(shown.mock.calls.length).toBe(beforeChunks);
  streams.get(other)!.enqueue(new Uint8Array(f.assets.get(other)!).slice(24)); streams.get(other)!.close();
  streams.get(a)!.enqueue(new Uint8Array(f.assets.get(a)!).slice(12)); streams.get(a)!.close();
  await vi.waitFor(() => expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({status:"ready",receivedBytes:total,totalBytes:total})));
});

test("manifest就绪即给出多分片总量，尚未开始的串行notice也在计划内", async () => {
  const f=await fixture(), scope=Symbol("multi"), progress=vi.fn();
  let release!:()=>void;let blocked=false;
  env.transport.mockImplementation(async input=>{
    const key=String(input).split("/").at(-1)!;
    if(key.endsWith("json")&&!key.startsWith(f.first.manifest!.sha256)){blocked=true;await new Promise<void>(resolve=>{release=resolve;});}
    return f.transport(input);
  });
  f.runtime.subscribeDownload(f.first.versionId,scope,progress);
  f.runtime.watch(f.first.versionId,"AB",vi.fn(),scope);
  await vi.waitFor(()=>expect(blocked).toBe(true));
  const total=[...f.assets].filter(([key])=>!key.endsWith("png")).reduce((sum,[,bytes])=>sum+bytes.byteLength,0);
  expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({totalBytes:total,phase:"downloading"}));
  release();await vi.waitFor(()=>expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({status:"ready"})));
});

test("完整缓存不宣称网络开始，撤回未完成资源发出回退而非永久进度", async () => {
  const f=await fixture(), scope=Symbol("cached"), progress=vi.fn();
  for(const [key,bytes] of f.assets)env.cache.set(key.split(".")[0]!,bytes);
  f.runtime.subscribeDownload(f.first.versionId,scope,progress);
  f.runtime.watch(f.first.versionId,"A",vi.fn(),scope);
  await vi.waitFor(()=>expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({status:"ready",started:false,receivedBytes:0,totalBytes:0})));
  expect(env.transport).not.toHaveBeenCalled();
  const otherScope=Symbol("withdraw"), other=vi.fn();
  env.cache.delete(f.shards[1]!.web.sha256);
  env.transport.mockImplementation(async()=>new Response(new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(4));}}),{headers:{"content-type":"font/woff2"}}));
  f.runtime.subscribeDownload(f.first.versionId,otherScope,other);
  f.runtime.watch(f.first.versionId,"B",vi.fn(),otherScope);
  await vi.waitFor(()=>expect(other.mock.calls.at(-1)?.[0].started).toBe(true));
  const {dynamicFontMetadata}=await import("@/api/dynamic-font-metadata");dynamicFontMetadata.withdraw(f.first.versionId);
  expect(other).toHaveBeenLastCalledWith(expect.objectContaining({status:"fallback"}));
});

test("实际需求等待描述符时仅准备，失败回退且恢复后完成；纯订阅不造需求", async () => {
  const f = await fixture(), scope = Symbol("slow-metadata"), progress = vi.fn();
  f.runtime.subscribeDownload(f.first.versionId, scope, progress);
  expect(progress).not.toHaveBeenCalled();
  expect(env.transport).not.toHaveBeenCalled();
  env.values.delete(f.first.versionId);
  f.runtime.watch(f.first.versionId, "A", vi.fn(), scope);
  expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ status: "loading", started: false, phase: "preparing", receivedBytes: 0, totalBytes: null }));
  env.unavailable.add(f.first.versionId);
  for (const cb of env.listeners.get(f.first.versionId)!) cb();
  expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ status: "fallback" }));
  env.unavailable.delete(f.first.versionId);
  env.values.set(f.first.versionId, f.first);
  for (const cb of env.listeners.get(f.first.versionId)!) cb();
  await vi.waitFor(() => expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ready" })));
});

test("空光标预订阅不会被同字体阅读完成解除，稍后输入仍可报告下载", async () => {
  const f = await fixture(), scope = Symbol("empty-author-caret"), progress = vi.fn(), reader = vi.fn();
  f.runtime.subscribeDownload(f.first.versionId, scope, progress);
  f.runtime.watch(f.first.versionId, "A", reader);
  await vi.waitFor(() => expect(reader).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ready" })));
  await flush();
  expect(progress).not.toHaveBeenCalled();
  f.runtime.watch(f.first.versionId, "B", vi.fn(), scope);
  await vi.waitFor(() => expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ready", started: true })));
  expect(progress.mock.calls.some(([value]) => value.status === "loading" && value.totalBytes > 0)).toBe(true);
});

test.each([false, true])("压缩许可资产完整性校验后才注册字库（篡改=%s）", async tampered => {
  const f = await fixture(), shown = vi.fn();
  const manifest = JSON.parse(new TextDecoder().decode(f.assets.get(f.first.manifest!.sha256 + ".json")!));
  const notice = manifest.notices[0];
  env.transport.mockImplementation(async input => {
    if (!String(input).endsWith(notice.sha256 + ".json")) return f.transport(input);
    const bytes = new Uint8Array(f.assets.get(notice.sha256 + ".json")!.slice(0));
    if (tampered) bytes[0] ^= 1;
    return new Response(bytes, { headers: { "content-type": "application/json", "content-encoding": "gzip", "content-length": "2" } });
  });
  f.runtime.watch(f.first.versionId, "A", shown);
  await vi.waitFor(() => expect(shown).toHaveBeenLastCalledWith(expect.objectContaining({ status: tampered ? "fallback" : "ready" })));
  if (tampered) {
    expect(env.install).not.toHaveBeenCalled();
    expect(env.cache.has(notice.sha256)).toBe(false);
    expect(f.runtime.snapshot.assets?.failures).toBe(1);
  } else {
    expect(env.install).toHaveBeenCalledExactlyOnceWith(f.shards[0], f.assets.get(f.shards[0].web.sha256 + ".woff2"));
    expect(env.cache.has(notice.sha256)).toBe(true);
  }
});

test("新 owner 的已驻留字形不等待策略重取，释放后租约归零", async () => {
  const f = await fixture();
  const first = vi.fn();
  const release = f.runtime.watch(f.first.versionId, "A", first);
  await vi.waitFor(() => expect(first).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ready" })));
  release();
  const requests = env.transport.mock.calls.length;
  env.policy.mockImplementation(() => new Promise(() => {}));
  const next = vi.fn();
  const dispose = f.runtime.watch(f.first.versionId, "A", next);
  await vi.waitFor(() => expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ready" })));
  expect(env.transport).toHaveBeenCalledTimes(requests);
  expect(env.install).toHaveBeenCalledTimes(1);
  dispose();
  expect(f.runtime.snapshot.residency.references).toBe(0);
});
